/* ==========================================================================
 *  PixelQG — RÉGLAGES DU SITE  (c'est le seul fichier à modifier)
 * ==========================================================================
 *
 *  CHECKOUT_URL : lien de paiement Stripe (Payment Link), par exemple
 *    "https://buy.stripe.com/xxxxxxxxxxxx". Le bouton « Acheter » de la page
 *    Mon compte y ajoute l'identifiant du compte connecté, pour que la licence
 *    soit attribuée automatiquement après le paiement.
 *    Le site ne collecte jamais de données bancaires : le paiement se fait chez Stripe.
 *    Tant que la valeur est vide, la page affiche « Paiement bientôt disponible ».
 */
const CHECKOUT_URL = "";

/*  CONTACT_EMAIL : adresse affichée dans le pied de page et les pages légales.  */
const CONTACT_EMAIL = "pro.hugobertagna@gmail.com";

/*  SUPABASE : valeurs publiques du projet (Project Settings → API).
 *  La clé « anon » est faite pour être publique : les règles de sécurité (RLS)
 *  sont appliquées côté serveur. Ne mets JAMAIS la clé « service_role » ici.
 *  Tant que ces valeurs restent des espaces réservés, les pages Mon compte et
 *  Workshop affichent « Les comptes ouvrent très bientôt ».
 */
const SUPABASE_URL = "https://qmkzuspakklzfcpdujlm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFta3p1c3Bha2tsemZjcGR1amxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MjMzMjksImV4cCI6MjEwNzk5OTMyOX0.ZQw9RzHUDXSLWB0rOull74DjTlc4gNsHe6cu_gpfY2s";
