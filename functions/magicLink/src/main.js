import { Client, Databases, Query } from 'node-appwrite';

// Collection IDs
const COL_BOOKINGS = 'bookings';
const COL_DRESSES = 'dresses';

export default async ({ req, res, log, error }) => {
  // 1. Initialiser le client Appwrite en mode Admin
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY); // Clé API Admin

  const database = new Databases(client);
  const DB_ID = process.env.APPWRITE_DATABASE_ID;

  // 2. Parser les données de la requête
  let payload;
  try {
    if (!req.bodyRaw) {
      throw new Error('Payload manquant');
    }
    payload = JSON.parse(req.bodyRaw);
  } catch (e) {
    error('Erreur de parsing du payload: ' + e.message);
    return res.json({ error: 'Payload JSON invalide.' }, 400);
  }

  const { userId, date, type } = payload;

  if (!userId || !date) {
    return res.json({ error: 'userId et date sont requis.' }, 400);
  }

  try {
    // 3. Gestion de la date
    // Le client envoie une date locale (ex: "2025-11-20")
    const localDate = new Date(date);
    
    // Créer le début du jour (local)
    const dateStart = new Date(localDate.setHours(0, 0, 0, 0));
    // Créer la fin du jour (local)
    const dateEnd = new Date(localDate.setHours(23, 59, 59, 999));
    
    // Convertir en ISO pour la requête Appwrite (qui stocke en UTC)
    const dateStartISO = dateStart.toISOString();
    const dateEndISO = dateEnd.toISOString();

    log(`Recherche de réservations pour ${userId} entre ${dateStartISO} et ${dateEndISO}`);

    // 4. Étape A : Récupérer toutes les robes DÉJÀ RÉSERVÉES ce jour-là
    const bookedDressIds = new Set();
    let offset = 0;
    let bookingsResponse;

    do {
      bookingsResponse = await database.listDocuments(
        DB_ID,
        COL_BOOKINGS,
        [
          Query.equal('userId', [userId]),
          Query.between('date', dateStartISO, dateEndISO), // Cible les réservations du jour
          Query.limit(100),
          Query.offset(offset),
          Query.select(['dressIds']), // On ne veut que les IDs des robes
        ]
      );

      bookingsResponse.documents.forEach(booking => {
        if (booking.dressIds && Array.isArray(booking.dressIds)) {
          booking.dressIds.forEach(id => bookedDressIds.add(id));
        }
      });
      offset += bookingsResponse.documents.length;
    } while (bookingsResponse.documents.length > 0);

    log(`Nombre d'IDs de robes réservées trouvés: ${bookedDressIds.size}`);

    // 5. Étape B : Récupérer les robes de l'utilisateur (filtrées par type)
    const dressQueries = [
      Query.equal('userId', [userId]),
      Query.limit(500) // Limite large, comme dans votre app
    ];
    
    if (type && type !== 'all') { // Si un type est spécifié (et n'est pas "tous")
      dressQueries.push(Query.equal('type', [type]));
      log(`Filtrage par type: ${type}`);
    }

    const allDressesResponse = await database.listDocuments(
      DB_ID,
      COL_DRESSES,
      dressQueries
    );

    // 6. Étape C : Filtrer les robes pour ne garder que les disponibles
    const availableDresses = allDressesResponse.documents.filter(dress => {
      // Retourne 'true' (garde la robe) si son ID n'est PAS dans le Set des robes réservées
      return !bookedDressIds.has(dress.$id);
    });

    log(`Total robes ${type}: ${allDressesResponse.total}, Robes disponibles: ${availableDresses.length}`);

    // 7. Renvoyer la liste des robes disponibles
    return res.json(availableDresses);

  } catch (e) {
    error('Erreur serveur lors de la récupération des robes: ' + e.message);
    return res.json({ error: 'Erreur interne du serveur.', details: e.message }, 500);
  }
};