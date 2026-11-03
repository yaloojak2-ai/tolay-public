// Storefront translation layer: Arabic is the source text; English and Hebrew are swapped in on the page.
// Each row: [Arabic, English, Hebrew]. Longer phrases are matched first, only on whole Arabic words.
window.I18N_ROWS = [
  // header / nav
  ["منتجات مكياج وعناية وعطور أصلية من أمريكا", "Original makeup, skincare & fragrance from the USA", "איפור, טיפוח ובשמים מקוריים מארה״ב"],
  ["وضع التاجر: أسعار الجملة ظاهرة لإلك", "Trader mode: wholesale prices are visible to you", "מצב סוחר: מחירי סיטונאות מוצגים לך"],
  ["ابحثي عن منتج أو براند…", "Search for a product or brand…", "חפשי מוצר או מותג…"],
  ["ابحثي عن ماركة…", "Search for a brand…", "חפשי מותג…"],
  ["بحث عن ماركة", "Search brands", "חיפוש מותג"],
  ["الرئيسية", "Home", "בית"], ["الماركات", "Brands", "מותגים"], ["الأقسام", "Categories", "קטגוריות"],
  ["حسابي", "Account", "החשבון שלי"], ["المفضلة", "Wishlist", "מועדפים"], ["السلة", "Cart", "סל"],
  ["التنقل", "Navigation", "ניווט"], ["سلتي", "My cart", "הסל שלי"], ["إغلاق", "Close", "סגירה"], ["بحث", "Search", "חיפוש"],
  // home
  ["جديدنا", "New in", "חדש אצלנו"], ["عرض الكل", "View all", "הצג הכל"],
  ["اكتشفي درجتك", "Find your shade", "מצאי את הגוון שלך"],
  ["3 أسئلة وبنختارلك الفاونديشن وأحمر الشفاه المناسبين", "3 questions and we'll pick your foundation and lipstick", "3 שאלות ונבחר לך מייקאפ ושפתון מתאימים"],
  ["3 أسئلة بس وبنختارلك الفاونديشن وأحمر الشفاه الأنسب لبشرتك.", "Just 3 questions and we'll pick the foundation and lipstick that suit your skin.", "רק 3 שאלות ונבחר לך מייקאפ ושפתון שמתאימים לעור שלך."],
  ["ابدئي الآن", "Start now", "התחילי עכשיו"], ["ابدئي", "Start", "התחילי"],
  ["العطور", "Fragrance", "בשמים"], ["كل العطور", "All fragrances", "כל הבשמים"],
  ["أصلي 100% من أمريكا", "100% original from the USA", "100% מקורי מארה״ב"],
  ["أصلي من أمريكا", "Original from the USA", "מקורי מארה״ב"],
  ["كل قطعة مستوردة من متاجر أمريكية معتمدة، من ماركات زي", "Every piece is imported from authorised US stores, from brands like", "כל פריט מיובא מחנויות מורשות בארה״ב, ממותגים כמו"],
  ["كل قطعة مستوردة من متاجر أمريكية معتمدة", "Every piece is imported from authorised US stores", "כל פריט מיובא מחנויות מורשות בארה״ב"],
  ["براندات عالمية", "Global brands", "מותגים בינלאומיים"], ["براند عالمي", "global brands", "מותגים בינלאומיים"], ["وغيرها", "and more", "ועוד"],
  ["طلب سهل عبر واتساب", "Easy ordering on WhatsApp", "הזמנה קלה בוואטסאפ"],
  ["السلة بتنبعت لنا برسالة جاهزة ومنرد عليكِ فوراً", "Your cart reaches us as a ready message and we reply right away", "הסל מגיע אלינו כהודעה מוכנה ואנחנו עונים מיד"],
  ["تسوّقي الآن", "Shop now", "לקנייה"], ["توصيل لكل مكان", "Delivery everywhere", "משלוח לכל מקום"],
  ["الضفة 20 · القدس 30 · الداخل 70. اطلبي عبر واتساب ومنرد عليكِ فوراً.", "West Bank 20 · Jerusalem 30 · Inside 70. Order on WhatsApp and we reply right away.", "הגדה 20 · ירושלים 30 · בפנים 70. הזמיני בוואטסאפ ונענה מיד."],
  ["شريحة", "Slide", "שקופית"], ["كل الماركات", "All brands", "כל המותגים"],
  // shop
  ["كل المنتجات", "All products", "כל המוצרים"], ["البراند", "Brand", "מותג"], ["كل البراندات", "All brands", "כל המותגים"],
  ["عم نحمّل المنتجات…", "Loading products…", "טוענים מוצרים…"],
  ["ما قدرنا نحمّل المنتجات، حدّثي الصفحة.", "We couldn't load the products, please refresh.", "לא הצלחנו לטעון מוצרים, רענני את הדף."],
  ["ما في نتائج، جرّبي كلمة تانية.", "No results, try another word.", "אין תוצאות, נסי מילה אחרת."],
  ["ما لقينا هالماركة.", "We couldn't find that brand.", "לא מצאנו את המותג."],
  ["الكل", "All", "הכל"], ["منتج", "products", "מוצרים"], ["ماركة", "brands", "מותגים"],
  ["ألوان متعددة", "Multiple shades", "גוונים שונים"], ["درجات", "shades", "גוונים"],
  ["جملة · أقل كمية", "Wholesale · min qty", "סיטונאות · כמות מינימלית"], ["السعر قريباً", "Price soon", "מחיר בקרוב"],
  ["أضيفي للمفضلة", "Add to wishlist", "הוספה למועדפים"], ["أضيفي للسلة", "Add to cart", "הוספה לסל"],
  ["وصل حديثاً", "Just arrived", "הגיע עכשיו"], ["نفذ من المخزون", "Out of stock", "אזל מהמלאי"], ["هالدرجة نفذت", "This shade is sold out", "הגוון אזל"], ["نفذ", "Sold out", "אזל"],
  ["لسا ما ضفتي ولا منتج للمفضلة.", "Your wishlist is empty.", "רשימת המועדפים ריקה."], ["تصفّحي المنتجات", "Browse products", "לכל המוצרים"],
  ["مفضلتي", "My wishlist", "המועדפים שלי"],
  // product
  ["بدّلي بين صورة المنتج والتجربة", "Switch between photo and try-on", "מעבר בין תמונה להדמיה"],
  ["الدرجة", "Shade", "גוון"], ["اكتبي اللون اللي بدك ياه بالملاحظات.", "write the shade you want in the notes.", "כתבי את הגוון הרצוי בהערות."],
  ["شاركي المنتج", "Share product", "שיתוף המוצר"], ["شاركي", "Share", "שיתוף"], ["كمّلي الإطلالة", "Complete the look", "השלימי את הלוק"],
  ["باقي", "Only", "נותרו"], ["بس", "left", "בלבד"], ["أضيفي", "Add", "הוסיפי"],
  // cart
  ["سلة الطلب", "Your order", "ההזמנה שלך"], ["طلب جملة", "Wholesale order", "הזמנה סיטונאית"],
  ["أسعار التوصيل: الضفة 20 · القدس 30 · الداخل", "Delivery: West Bank 20 · Jerusalem 30 · Inside", "משלוח: הגדה 20 · ירושלים 30 · בפנים"],
  ["الضفة 20 · القدس 30 · الداخل", "West Bank 20 · Jerusalem 30 · Inside", "הגדה 20 · ירושלים 30 · בפנים"],
  ["أسعار التوصيل", "Delivery fees", "דמי משלוח"], ["منطقة التوصيل", "Delivery area", "אזור משלוח"],
  ["اختاري منطقة التوصيل", "Choose a delivery area", "בחרי אזור משלוח"], ["اختاري المنطقة", "Choose area", "בחרי אזור"],
  ["الضفة الغربية", "West Bank", "הגדה המערבית"], ["القدس", "Jerusalem", "ירושלים"], ["الداخل", "Inside (48)", "בפנים (48)"],
  ["المنتجات", "Products", "מוצרים"], ["التوصيل", "Delivery", "משלוח"], ["الإجمالي", "Total", "סה״כ"],
  ["المدينة والعنوان", "City & address", "עיר וכתובת"], ["ملاحظات (اللون، الدرجة…)", "Notes (colour, shade…)", "הערות (צבע, גוון…)"], ["ملاحظات", "Notes", "הערות"],
  ["إرسال الطلب عبر واتساب", "Send order on WhatsApp", "שליחת ההזמנה בוואטסאפ"],
  ["إذا ما فتح واتساب، ابعتي لنا على", "If WhatsApp doesn't open, message us at", "אם וואטסאפ לא נפתח, כתבי לנו ל"],
  ["للطلب والاستفسار واتساب", "Orders & questions on WhatsApp", "הזמנות ושאלות בוואטסאפ"],
  ["يتأكد بالواتساب", "Confirmed on WhatsApp", "יאושר בוואטסאפ"], ["انضافت للسلة ✓", "Added to cart ✓", "נוסף לסל ✓"],
  ["إزالة", "Remove", "הסרה"], ["أقل", "Less", "פחות"], ["أكثر", "More", "יותר"],
  ["السلة فاضية. ضيفي منتجاتك المفضلة من المتجر.", "Your cart is empty. Add your favourites from the shop.", "הסל ריק. הוסיפי מוצרים מהחנות."],
  ["السلة فاضية", "Your cart is empty", "הסל ריק"], ["اكتبي اسمك لنكمّل الطلب", "Write your name to continue", "כתבי את שמך כדי להמשיך"],
  ["انحفظ طلبك رقم", "Order saved, number", "ההזמנה נשמרה, מספר"], ["بعد خصم", "after discount", "אחרי הנחה"],
  ["الاسم", "Name", "שם"], ["العنوان", "Address", "כתובת"], ["الهاتف", "Phone", "טלפון"],
  // quiz
  ["شو لون بشرتك؟", "What's your skin tone?", "מה גוון העור שלך?"], ["فاتحة", "Fair", "בהיר"], ["قمحية", "Medium", "בינוני"], ["سمراء", "Tan", "שזוף"], ["غامقة", "Deep", "כהה"],
  ["شو التحت لون؟ (عروق معصمك خضرا = دافئ، زرقا = بارد)", "Your undertone? (green wrist veins = warm, blue = cool)", "מה הגוון התחתון? (ורידים ירוקים = חם, כחולים = קר)"],
  ["دافئ", "Warm", "חם"], ["بارد", "Cool", "קר"], ["مش متأكدة", "Not sure", "לא בטוחה"],
  ["شو ستايلك؟", "What's your style?", "מה הסגנון שלך?"], ["طبيعي وناعم", "Natural & soft", "טבעי ועדין"], ["جريء وواضح", "Bold & striking", "נועז ובולט"],
  ["سؤال", "Question", "שאלה"], ["من", "of", "מתוך"], ["فاونديشن", "Foundation", "מייקאפ"], ["أحمر شفاه", "Lipstick", "שפתון"],
  ["اخترنالك", "Picked for you", "בחרנו לך"], ["درجاتك المناسبة", "Your matching shades", "הגוונים שמתאימים לך"],
  ["ما لقينا درجات مناسبة حالياً.", "No matching shades right now.", "אין כרגע גוונים מתאימים."],
  ["ابعتيها عالواتساب", "Send on WhatsApp", "שלחי בוואטסאפ"], ["من جديد", "Start over", "מההתחלה"], ["شوفي", "See", "לצפייה"],
  // levels
  ["مستواكِ هالشهر", "Your level this month", "הרמה שלך החודש"], ["مشترياتك هالشهر", "Your purchases this month", "הרכישות שלך החודש"],
  ["باقيلك", "You need", "חסרים לך"], ["لتوصلي لمستوى", "to reach", "כדי להגיע לרמת"], ["الشهر الجاي.", "next month.", "בחודש הבא."],
  ["وصلتِ لأعلى مستوى", "You reached the top level", "הגעת לרמה הגבוהה ביותר"], ["خصمك هالشهر", "your discount this month", "ההנחה שלך החודש"], ["الخصم", "Discount", "הנחה"],
  ["المستوى بينحسب من الطلبات اللي تم تسليمها بالشهر اللي قبله.", "Your level is based on delivered orders in the previous month.", "הרמה מחושבת לפי הזמנות שנמסרו בחודש הקודם."],
  // orders / account
  ["جديد", "New", "חדש"], ["مؤكد", "Confirmed", "מאושר"], ["تم التسليم", "Delivered", "נמסר"], ["ملغي", "Cancelled", "בוטל"],
  ["‹ رجوع", "‹ Back", "‹ חזרה"], ["رجوع", "Back", "חזרה"], ["طلباتي", "My orders", "ההזמנות שלי"], ["لحظة…", "One moment…", "רגע…"],
  ["ما قدرنا نحمّل الطلبات.", "We couldn't load your orders.", "לא הצלחנו לטעון את ההזמנות."], ["لسا ما في طلبات محفوظة.", "No saved orders yet.", "אין עדיין הזמנות שמורות."],
  ["السعر يتأكد", "Price to confirm", "המחיר יאושר"], ["أعيدي الطلب", "Order again", "הזמיני שוב"],
  ["رجعت المنتجات للسلة ✓", "Items are back in your cart ✓", "המוצרים חזרו לסל ✓"], ["المنتجات مش متوفرة حالياً", "These items aren't available right now", "המוצרים לא זמינים כרגע"],
  ["فاونديشن وأحمر شفاه مناسبين لبشرتك", "Foundation and lipstick for your skin", "מייקאפ ושפתון שמתאימים לעור שלך"],
  ["تواصلي معنا", "Contact us", "צרי קשר"], ["واتساب", "WhatsApp", "וואטסאפ"], ["كل طلباتك وإعادة الطلب", "All your orders and quick reorder", "כל ההזמנות והזמנה חוזרת"],
  ["حسابك فعّال. طلباتك بتنحفظ هون وبتقدري تعيديها بضغطة.", "Your account is active. Your orders are saved here and you can reorder in one tap.", "החשבון פעיל. ההזמנות נשמרות כאן ואפשר להזמין שוב בלחיצה."],
  ["طلبك قيد المراجعة. رح نفعّل حسابك بأقرب وقت ونبلّغك.", "Your request is under review. We'll activate your account soon and let you know.", "הבקשה בבדיקה. נפעיל את החשבון בקרוב ונעדכן אותך."],
  ["حسابك مفعّل وأسعار الجملة ظاهرة لإلك.", "Your account is active and wholesale prices are visible to you.", "החשבון פעיל ומחירי הסיטונאות מוצגים לך."],
  ["للأسف ما تمت الموافقة على الحساب. تواصلي معنا عالواتساب.", "Sorry, the account wasn't approved. Contact us on WhatsApp.", "מצטערים, החשבון לא אושר. צרי קשר בוואטסאפ."],
  ["لوحة التحكم", "Admin panel", "לוח בקרה"], ["إدارة المنتجات والطلبات", "Manage products and orders", "ניהול מוצרים והזמנות"], ["تسجيل خروج", "Log out", "התנתקות"],
  ["أهلاً فيكِ في", "Welcome to", "ברוכה הבאה ל"],
  ["إذا عندك محل، ادخلي كتاجرة لتشوفي أسعار الجملة.", "If you own a shop, log in as a trader to see wholesale prices.", "אם יש לך חנות, התחברי כסוחרת כדי לראות מחירי סיטונאות."],
  ["تسجيل دخول", "Log in", "התחברות"], ["لزبائن المفرق والتجار", "For customers and traders", "ללקוחות ולסוחרים"],
  ["حساب جديد للزبائن", "New customer account", "חשבון לקוח חדש"], ["تابعي طلباتك وأعيديها بضغطة", "Track your orders and reorder in one tap", "עקבי אחרי הזמנות והזמיני שוב בלחיצה"],
  ["طلب حساب جملة", "Apply for a wholesale account", "בקשה לחשבון סיטונאי"], ["للمحلات وأصحاب المتاجر، بموافقة الإدارة", "For shops and store owners, with admin approval", "לחנויות ובעלי עסקים, באישור ההנהלה"],
  ["لزبائن المفرق", "For retail customers", "ללקוחות פרטיים"], ["للتجار وأصحاب المحلات", "For traders and shop owners", "לסוחרים ובעלי חנויות"], ["زبائن وتجار", "Customers & traders", "לקוחות וסוחרים"],
  ["حساب جديد", "New account", "חשבון חדש"], ["طلب حساب", "Apply", "בקשה"], ["دخول", "Log in", "כניסה"], ["إرسال الطلب", "Send request", "שליחת בקשה"],
  ["اسم المحل", "Shop name", "שם החנות"], ["رقم الهاتف", "Phone number", "מספר טלפון"], ["المدينة", "City", "עיר"], ["الإيميل", "Email", "אימייל"], ["كلمة السر", "Password", "סיסמה"],
  ["انبعتلك إيميل تأكيد. أكّديه وبعدين ادخلي، وطلبك رح يتراجع ويتفعّل.", "We sent you a confirmation email. Confirm it and log in; your request will be reviewed.", "שלחנו לך מייל אישור. אשרי אותו והתחברי, והבקשה תיבדק."],
  ["انبعتلك إيميل تأكيد. أكّديه وبعدين ادخلي.", "We sent you a confirmation email. Confirm it, then log in.", "שלחנו לך מייל אישור. אשרי אותו ואז התחברי."],
  ["الإيميل أو كلمة السر غلط، أو الإيميل لسا مش مأكّد.", "Wrong email or password, or the email isn't confirmed yet.", "אימייל או סיסמה שגויים, או שהאימייל עדיין לא אושר."],
  ["لغة", "Language", "שפה"],
  // categories (from the database)
  ["البرايمر", "Primer", "פריימר"], ["البشرة والبودرة", "Face & powder", "פנים ופודרה"], ["الخدود", "Cheeks", "לחיים"], ["الماسكارا", "Mascara", "מסקרה"],
  ["ظلال العيون", "Eyes", "עיניים"], ["الحواجب", "Brows", "גבות"], ["الشفاه", "Lips", "שפתיים"], ["العناية بالبشرة", "Skincare", "טיפוח העור"],
  ["العناية بالشعر", "Haircare", "טיפוח השיער"], ["الهدايا", "Gifts", "מתנות"], ["أدوات المكياج", "Makeup tools", "כלי איפור"],
  // Arabic parts of product names
  ["كبير + ميني", "full size + mini", "גודל מלא + מיני"], ["بودرة مضغوطة", "pressed powder", "פודרה דחוסה"], ["بلاشر سائل", "liquid blush", "סומק נוזלי"],
  ["باليت بلاشر وهايلايتر", "Blush & highlighter palette", "פלטת סומק והיילייטר"], ["إصدار محدود", "limited edition", "מהדורה מוגבלת"], ["باليت", "palette", "פלטה"],
  ["ستيك بلاشر/شفاه بقاعدة ذهبية", "Blush/lip stick with gold base", "סטיק סומק/שפתיים בבסיס זהב"], ["مجموعة", "set", "סט"],
  ["النسخة الذهبية", "gold edition", "מהדורת זהב"], ["قلم", "pencil", "עיפרון"], ["أحمر شفاه بعلبة فضية", "Lipstick in a silver case", "שפתון בקופסה כסופה"],
  ["كريم يدين", "hand cream", "קרם ידיים"], ["مع شنطة", "with bag", "עם תיק"], ["بخاخ شعر وجسم", "hair & body mist", "ערפל לשיער ולגוף"], ["بخاخات", "mists", "ערפלים"],
  ["5 قطع", "5 pieces", "5 יחידות"], ["تقويم 24 يوم", "24-day calendar", "לוח 24 ימים"], ["خدود وشفاه", "cheeks & lips", "לחיים ושפתיים"],
  ["4 ميني", "4 minis", "4 מיני"], ["باليت ظلال", "eyeshadow palette", "פלטת צלליות"], ["إصدار الأعياد", "holiday edition", "מהדורת חגים"],
  ["روج + 2 عبوة", "lipstick + 2 refills", "שפתון + 2 מילויים"], ["قلم شفاه", "lip liner", "עיפרון שפתיים"], ["بعلب ملوّنة", "in colourful cases", "בקופסאות צבעוניות"],
  ["مجموعة بلاشر + ليب", "Blush + lip set", "סט סומק + שפתיים"], ["علبة هدايا Dior", "Dior gift box", "קופסת מתנה Dior"], ["علبة هدايا", "gift box", "קופסת מתנה"],
  ["مجموعة ميني", "mini set", "סט מיני"], ["مجموعة 3 قطع", "3-piece set", "סט 3 יחידות"], ["4 قطع ميني", "4 minis", "4 מיני"], ["مجموعة 4 قطع", "4-piece set", "סט 4 יחידות"],
  // home hero (from the admin settings)
  ["جمالك الأصلي،", "Your original beauty,", "היופי המקורי שלך,"], ["جايّك من أمريكا", "straight from the USA", "ישר מארה״ב"],
  ["تشكيلة مختارة من أشهر براندات المكياج والعناية والعطور، منتجات أصلية ١٠٠٪ بتوصلك لعندك. اختاري، ضيفي للسلة، وابعتي طلبك بكبسة واتساب.", "A curated selection of the most loved makeup, skincare and fragrance brands, 100% original and delivered to your door. Choose, add to cart, and send your order with one WhatsApp tap.", "מבחר מהמותגים האהובים באיפור, טיפוח ובשמים, 100% מקוריים עד הבית. בחרי, הוסיפי לסל ושלחי הזמנה בלחיצת וואטסאפ."],
  ["مل", "ml", "מ״ל"], ["غ", "g", "גר׳"],
];

(() => {
  let L = "ar";
  try { L = localStorage.getItem("tolay-lang") || "ar"; } catch {}
  window.LANG = L;
  window.setLang = l => { try { localStorage.setItem("tolay-lang", l); } catch {} location.reload(); };
  const col = { en: 1, he: 2 }[L];
  if (!col) return;  // Arabic is the source, nothing to swap
  const html = document.documentElement;
  html.lang = L; html.dir = L === "he" ? "rtl" : "ltr";
  const rows = I18N_ROWS.slice().sort((a, b) => b[0].length - a[0].length);
  const map = new Map(rows.map(r => [r[0], r[col]]));
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // whole Arabic words only, so "منتج" never eats part of "منتجات"
  const re = new RegExp("(?<![\\u0600-\\u06FF])(" + rows.map(r => esc(r[0])).join("|") + ")(?![\\u0600-\\u06FF])", "g");
  const AR = /[؀-ۿ]/;
  const AND = L === "he" ? "ו" : "& ";
  // the Arabic "و" (and) glued to a Latin brand name, and Arabic punctuation
  const tx = s => AR.test(s) ? s.replace(re, m => map.get(m)).replace(/(^|[\s(])و(?=[A-Za-z])/g, "$1" + AND).replace(/،/g, ",").replace(/؟/g, "?") : s;
  window.tx = tx;
  const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT"]);
  const ATTRS = ["placeholder", "aria-label", "title"];
  const fixEl = el => ATTRS.forEach(a => { const v = el.getAttribute?.(a); if (v && AR.test(v)) { const t = tx(v); if (t !== v) el.setAttribute(a, t); } });
  function walk(root) {
    if (root.nodeType === 3) { if (!SKIP.has(root.parentNode?.nodeName) && AR.test(root.data)) { const t = tx(root.data); if (t !== root.data) root.data = t; } return; }
    if (root.nodeType !== 1 || SKIP.has(root.nodeName)) { if (root.nodeType === 1) fixEl(root); return; }
    fixEl(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 1) fixEl(n);
      else if (!SKIP.has(n.parentNode.nodeName) && AR.test(n.data)) { const t = tx(n.data); if (t !== n.data) n.data = t; }
    }
  }
  const start = () => {
    walk(document.body);
    new MutationObserver(ms => ms.forEach(m => {
      if (m.type === "characterData") walk(m.target);
      else if (m.type === "attributes") fixEl(m.target);
      else m.addedNodes.forEach(walk);
    })).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
})();
