// Gate -1 Hosting publication contract. Every entry must be a tracked path.
export const PUBLIC_ROOT_FILES = [
  "CNAME", "favicon.ico", "robots.txt", "llms.txt", "sitemap.xml",
  "index.html", "index-v2.html", "product.html", "product-v2.html",
  "login.html", "signup.html", "mypage.html", "success.html",
  "payment-success.html", "payment-fail.html", "auth-fail.html",
  "suvey.html", "report-loading.html", "report.html",
  "program-loading.html", "program.html", "regenerate.html",
  "interpretation.html", "action-program.html", "report-guide.html",
  "program-guide.html", "privacy.html", "terms.html",
  "b2b.html", "b2b-checkout.html", "b2b-join.html", "b2b-quote.html",
  "b2b-privacy.html", "b2b-terms.html",
  "checkin-21.html", "checkin-21-en.html", "checkin-21-form.html",
  "checkin-21-form-en.html", "checkin-21-chat.html", "checkin-21-chat-en.html",
];

export const PUBLIC_TREES = ["assets", "blog"];

export const PUBLIC_DATA_FILES = [
  "data/questions.json", "data/mapping.json", "data/report-rules.json",
  "data/program-rules.json", "data/career-rules.json", "data/answer-kit.json",
];

// Never published even when a parent tree is public.
export const TREE_EXCLUDES = [
  "assets/signature",
  "assets/lead",
  "assets/brand/official-logo-source.png",
  "assets/lead/b2b-onepager-source.html",
  "assets/lead/workbook-source.html",
];

export const ALLOWED_EXTENSIONS = new Set([
  ".html", ".css", ".js", ".json", ".txt", ".xml", ".webmanifest",
  ".ico", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif",
  ".woff", ".woff2", ".ttf", ".otf", ".eot", ".mp3", ".mp4",
]);
