import { Client, Databases } from 'node-appwrite';

const DB_ID = '690f560f001394b2c1a6';
const COL_DRESSES = 'dresses';

export default async ({ req, res, log, error }) => {
const client = new Client()
  .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT) // ✅ pas APPWRITE_ENDPOINT
  .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);
  const databases = new Databases(client);

  try {
    const trigger = req.headers['x-appwrite-trigger']; // 'event' ou 'http'
    const event = req.headers['x-appwrite-event'] || ''; // ...create / ...delete / ...update
    const body = req.body || {};

    log('trigger:', trigger);
    log('event:', event);

    // Déterminer +1 / -1 (event) ou via HTTP fallback (payload.action)
    let inc = 0;
    if (trigger === 'event') {
      if (event.includes('.create')) inc = 1;
      else if (event.includes('.delete')) inc = -1;
      else inc = 0;
    } else if (trigger === 'http') {
      const a = (body.action || '').toString().toLowerCase();
      if (a === 'create') inc = 1;
      else if (a === 'delete') inc = -1;
    }

    if (inc === 0) {
      return res.json({ success: true, message: 'Event/Action non géré (ni create ni delete).' });
    }

    // Récupérer la liste d’IDs de robes depuis le document de booking
    const dressIds =
      (Array.isArray(body.dressIds) && body.dressIds) ||
      (Array.isArray(body.dresses) && body.dresses) ||
      [];

    if (!dressIds.length) {
      log('Aucun dressIds trouvé, aucune action.');
      return res.json({ success: true, message: 'No dressIds to update.' });
    }

    // Read -> Write (sans helper increment)
    // NB: ceci n’est pas atomique; si tu as de la forte concurrence,
    // il faudra prévoir une stratégie de retry.
    const results = await Promise.allSettled(
      dressIds.map(async (dressId) => {
        try {
          const doc = await databases.getDocument(DB_ID, COL_DRESSES, dressId);
          const current = Number(doc.nb_reservation || 0);
          const next = current + inc;

          await databases.updateDocument(DB_ID, COL_DRESSES, dressId, {
            nb_reservation: next,
          });

          log(`Maj robe ${dressId}: ${current} -> ${next}`);
          return { dressId, ok: true, from: current, to: next };
        } catch (e) {
          error(`Échec maj robe ${dressId}: ${e.message}`);
          throw new Error(`dress ${dressId}: ${e.message}`);
        }
      })
    );

    const ok = results.filter(r => r.status === 'fulfilled').length;
    const ko = results.length - ok;

    return res.json({
      success: ko === 0,
      updated: ok,
      failed: ko,
      details: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message }),
    }, ko ? 207 : 200); // 207 Multi-Status si partiel
  } catch (e) {
    error('updateRentalCount error:', e.message);
    return res.json({ success: false, error: e.message }, 500);
  }
};
