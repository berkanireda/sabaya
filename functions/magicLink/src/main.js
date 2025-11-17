import { Client, Databases, Query } from 'node-appwrite';

// Collection IDs
const COL_BOOKINGS = 'bookings';
const COL_DRESSES = 'dresses';

export default async ({ req, res, log, error }) => {
  // 1. Initialiser le client Appwrite en mode Admin
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

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

  // MODIFIÉ : Récupérer les nouveaux filtres
  const { userId, date, type, size, minPrice, maxPrice } = payload;

  if (!userId || !date) {
    return res.json({ error: 'userId et date sont requis.' }, 400);
  }

  try {
    // 3. Gestion de la date (inchangée)
    const localDate = new Date(date);
    const dateStart = new Date(localDate.setHours(0, 0, 0, 0));
    const dateEnd = new Date(localDate.setHours(23, 59, 59, 999));
    const dateStartISO = dateStart.toISOString();
    const dateEndISO = dateEnd.toISOString();

    log(`Recherche de réservations pour ${userId} entre ${dateStartISO} et ${dateEndISO}`);

    // 4. Étape A : Récupérer les robes DÉJÀ RÉSERVÉES (inchangée)
    const bookedDressIds = new Set();
    let offset = 0;
    let bookingsResponse;

    do {
      bookingsResponse = await database.listDocuments(
        DB_ID,
        COL_BOOKINGS,
        [
          Query.equal('userId', [userId]),
          Query.between('date', dateStartISO, dateEndISO),
          Query.limit(100),
          Query.offset(offset),
          Query.select(['dressIds']),
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

    // 5. Étape B : Récupérer les robes de l'utilisateur (AVEC LES NOUVEAUX FILTRES)
    const dressQueries = [
      Query.equal('userId', [userId]),
      Query.limit(500)
    ];
    
    // Filtre par Type
    if (type && type !== 'all') {
      dressQueries.push(Query.equal('type', [type]));
      log(`Filtrage par type: ${type}`);
    }

    // NOUVEAU : Filtre par Taille
    if (size) {
      dressQueries.push(Query.equal('size', [size]));
      log(`Filtrage par taille: ${size}`);
    }

    // NOUVEAU : Filtre par Prix Minimum
    if (minPrice && parseFloat(minPrice) > 0) {
      dressQueries.push(Query.greaterThanEqual('price', parseFloat(minPrice)));
      log(`Filtrage par prix min: ${minPrice}`);
    }
    
    // NOUVEAU : Filtre par Prix Maximum
    if (maxPrice && parseFloat(maxPrice) > 0) {
      dressQueries.push(Query.lessThanEqual('price', parseFloat(maxPrice)));
      log(`Filtrage par prix max: ${maxPrice}`);
    }

    const allDressesResponse = await database.listDocuments(
      DB_ID,
      COL_DRESSES,
      dressQueries
    );

    // 6. Étape C : Filtrer les robes pour ne garder que les disponibles (inchangée)
    const availableDresses = allDressesResponse.documents.filter(dress => {
      return !bookedDressIds.has(dress.$id);
    });

    log(`Total robes filtrées: ${allDressesResponse.total}, Robes disponibles: ${availableDresses.length}`);

    // 7. Renvoyer la liste des robes disponibles (inchangée)
    return res.json(availableDresses);

  } catch (e) {
    error('Erreur serveur lors de la récupération des robes: ' + e.message);
    return res.json({ error: 'Erreur interne du serveur.', details: e.message }, 500);
  }
};