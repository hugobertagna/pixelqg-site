/* ==========================================================================
 *  PixelQG — RÉGLAGES DU SITE  (c'est le seul fichier à modifier)
 * ==========================================================================
 *
 *  PAYMENT_PROVIDER : "lemonsqueezy" ou "stripe".
 *    - Lemon Squeezy est un « merchant of record » : c'est lui le vendeur
 *      officiel aux yeux du client. Il encaisse, facture et reverse la TVA
 *      européenne de chaque pays à ta place (pas de déclaration OSS à faire),
 *      puis te verse le reste. Recommandé pour vendre seul dans toute l'UE.
 *    - Stripe : tu restes le vendeur, donc la TVA et les factures sont à ta charge.
 *
 *  CHECKOUT_URL : lien de paiement du produit PixelQG, par exemple
 *    - Lemon Squeezy : "https://ton-shop.lemonsqueezy.com/buy/xxxxxxxx"
 *    - Stripe (Payment Link) : "https://buy.stripe.com/xxxxxxxxxxxx"
 *    Le bouton « Acheter » de la page Mon compte y ajoute l'identifiant et l'e-mail
 *    du compte connecté (Lemon Squeezy : checkout[custom][user_id] et checkout[email] ;
 *    Stripe : client_reference_id et prefilled_email), pour que la licence soit
 *    attribuée automatiquement après le paiement. Règle la redirection après achat
 *    sur https://pixelqg-site.pages.dev/compte.html?achat=ok
 *    Le site ne collecte jamais de données bancaires.
 *    Tant que CHECKOUT_URL est vide, les zones « Acheter » proposent
 *    « Préviens-moi au lancement » (liste d'attente).
 */
const PAYMENT_PROVIDER = "lemonsqueezy";
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
