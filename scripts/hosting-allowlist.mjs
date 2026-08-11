// Gate -1 Hosting publication contract. Every entry must be a tracked path.
export const PUBLIC_ROOT_FILES = [
  "CNAME", "favicon.ico", "robots.txt", "llms.txt", "sitemap.xml",
  "assets/favicon.svg", "assets/favicon-32.png", "assets/apple-touch-icon.png",
  "assets/never-too-late-infographic.png", "assets/lp-rtdb.js",
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
  "customer-journey.html", "report-landing.html",
  "assets/site.webmanifest", "blog/index.html", "blog/en/index.html",
  "blog/post.css", "blog/rss.xml", "blog/rss-en.xml", "blog/inside-76-questions-1pager.html",
];

// Purpose-specific public trees. Source/signing/lead/admin trees are excluded.
export const PUBLIC_TREES = [
  "assets/css", "assets/js", "assets/img", "assets/images", "assets/icons",
  "assets/fonts", "assets/audio", "assets/video", "assets/i18n", "assets/data",
  "assets/blog", "assets/og", "assets/startup", "assets/trademark",
  "assets/journey",
  "blog/assets", "blog/posts", "blog/posts-en",
  "blog/developer-notes-platform",
];

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
