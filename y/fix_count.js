// Script de rattrapage à usage unique
const { Client, Databases, Query } = require('node-appwrite');

const DB_ID = '690f560f001394b2c1a6';
const COL_DRESSES = 'dresses';
const COL_BOOKINGS = 'bookings';
const PROJECT_ID = '690f54f700273a8387b3';
const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const API_KEY = 'standard_a3c9686761522c3ee7d9219f377c2f570bde5ed7cf70316c6110d6ee79621c3a1c002a4f5a0b757f70b25289f54688c33e023e842872147e71308997a0f1f3ec9da06be726b5797e8f08d5faa904b429e4de1dd2fa5a22facfe6aaae06cdb220bbcd7051ffec5d4ef7f53d2f3eb227a8e26a1baa13519a23e2a79f67b947350b'; // Mettez votre clé ici

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

async function runFix() {
  console.log('Démarrage du script de rattrapage...');
  try {
    // 1. Récupérer TOUTES les réservations
    console.log('Chargement de toutes les réservations...');
    const { documents: allBookings } = await databases.listDocuments(
      DB_ID,
      COL_BOOKINGS,
      [Query.limit(5000)] // Augmentez si vous avez plus de 5000 réservations
    );
    console.log(`Trouvé ${allBookings.length} réservations.`);

    // 2. Compter les réservations pour chaque robe
    const counts = {}; // ex: { 'robeId_A': 5, 'robeId_B': 2 }
    for (const booking of allBookings) {
      if (Array.isArray(booking.dressIds)) {
        for (const dressId of booking.dressIds) {
          counts[dressId] = (counts[dressId] || 0) + 1;
        }
      }
    }

    console.log('Comptage terminé. Mise à jour des robes...');

    // 3. Réinitialiser d'abord toutes les robes à 0 (sécurité)
    // C'est optionnel mais plus propre si vous relancez le script
    const { documents: allDresses } = await databases.listDocuments(
      DB_ID,
      COL_DRESSES,
      [Query.limit(500)]
    );
    for (const dress of allDresses) {
      await databases.updateDocument(DB_ID, COL_DRESSES, dress.$id, { nb_reservation: 0 });
    }
    console.log('Toutes les robes ont été réinitialisées à 0.');

    // 4. Mettre à jour les robes avec le bon comptage
    const updatePromises = [];
    for (const dressId in counts) {
      const count = counts[dressId];
      console.log(`Mise à jour de la robe ${dressId} avec le compte ${count}`);
      updatePromises.push(
        databases.updateDocument(DB_ID, COL_DRESSES, dressId, {
          nb_reservation: count
        })
      );
    }
    
    await Promise.all(updatePromises);
    console.log('Script de rattrapage terminé avec succès !');

  } catch (error) {
    console.error('Erreur pendant le script de rattrapage:', error);
  }
}

runFix();