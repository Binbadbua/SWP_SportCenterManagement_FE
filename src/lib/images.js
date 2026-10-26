// The API has no image fields for classes or sports, so the UI picks a photo
// from /public/images by matching the sport/class name (English or Vietnamese).
// Each base name has <name>.jpg (the sport) and <name>-Room-1.jpg / -Room-2.jpg (its rooms).
// Photos: Unsplash (https://unsplash.com/license) and Wikimedia Commons — see public/images/CREDITS.md.

// The first rule that matches wins, so specific sports come before the broad ones below
// (the Gym rule's "t[ạa]" would otherwise catch "Taekwondo", the Boxing rule "võ"/"muay").
const RULES = [
  [/b[óo]ng chuy[ềe]n|volley/i, "volleyball"],
  [/taekwondo|karate|vovinam/i, "taekwondo"],
  [/muay/i, "muay-thai"],
  [/pickleball/i, "pickleball"],
  [/leo n[úu]i|climb|boulder/i, "climbing"],
  [/yoga/i, "yoga"],
  [/pilates|core|bụng|giãn cơ|stretch/i, "core-pilates"],
  [/b[ơo]i|swim|pool/i, "swimming"],
  [/b[óo]ng b[àa]n|table ?tennis|ping ?pong/i, "table-tennis"],
  [/tennis|quần vợt/i, "tennis"],
  [/b[óo]ng r[ổo]|basket/i, "basketball"],
  [/b[óo]ng đ[áa]|football|soccer|futsal/i, "football"],
  [/c[ầa]u l[ôo]ng|badminton/i, "badminton"],
  [/ch[ạa]y|run|marathon|điền kinh|athlet|track/i, "running"],
  [/cycling|đạp xe|xe đạp/i, "Indoor-Cycling"],
  [/hiit|cardio|rope/i, "hiit-ropes"],
  [/nh[óo]m|group|dance|aerobic|zumba/i, "group-fitness"],
  [/gym|t[ạa]|strength|lift|power|thể hình|crossfit/i, "strength-dumbbell"],
  [/kickboxing|kick/i, "kickboxing"],
  [/boxing|võ|muay/i, "boxing"],
];

const FALLBACKS = [
  "gym-floor",
  "coach-curl",
  "deadlift",
  "gym-interior",
  "dumbbell-rack",
  "group-fitness",
];

const hash = (s = "") =>
  [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function sportImage(...names) {
  const text = names.filter(Boolean).join(" ");
  const hit = RULES.find(([re]) => re.test(text));
  const file = hit ? hit[1] : FALLBACKS[hash(text) % FALLBACKS.length];
  return `/images/${file}.jpg`;
}

// Home page hero background slideshow, shown in this order and then looped. The headline changes
// with the photo; the rest of the hero text stays the same.
// To add a photo: put the file in public/images/ and add one line here.
//   src       path from public/ (always starts with /images/)
//   alt       short description for screen readers
//   position  which part of the photo stays in view when it is cropped (CSS object-position),
//             e.g. "center", "60% 40%" (60% from the left, 40% from the top)
//   title     the headline shown with this photo, one string per line (keep lines to ~9 letters:
//             the headline is huge and must fit a phone screen)
// Best results: landscape JPG/WebP, at least 1920×1080, under ~400 KB, subject away from the
// bottom-left corner where the headline sits.
export const HERO_SLIDES = [
  { src: "/images/tennis.jpg", alt: "Nhìn từ trên cao một người chơi tennis đang giao bóng trên sân đất nện", position: "60% 40%", title: ["Đến lượt", "bạn."] },
  { src: "/images/yoga.jpg", alt: "Lớp yoga lúc bình minh", position: "center 40%", title: ["Hít thở", "thật sâu."] },
  { src: "/images/swimming.jpg", alt: "Vận động viên bơi bướm trong làn bơi", position: "center 45%", title: ["Bơi xa", "hơn nữa."] },
  { src: "/images/hiit-ropes.jpg", alt: "Vận động viên tập với dây thừng chiến đấu", position: "70% center", title: ["Đốt cháy", "giới hạn."] },
  { src: "/images/basketball.jpg", alt: "Quả bóng rổ rơi qua vành rổ", position: "center 30%", title: ["Ghi điểm", "mỗi ngày."] },
];

// Milliseconds. `interval` = how long each photo stays (fade included), `fade` = length of the
// fade-out and of the fade-in that follows it. Keep interval at least 3 × fade.
export const HERO_TIMING = { interval: 7000, fade: 1200 };

// Sign-in page photo panel: each photo pans slowly from left to right, then the next one fades
// in. Same fields as HERO_SLIDES; keep these different from the hero photos and use at least 3.
export const LOGIN_SLIDES = [
  { src: "/images/deadlift.jpg", position: "55% 40%" },
  { src: "/images/climbing.jpg", position: "65% 40%" },
  { src: "/images/running.jpg", position: "45% 50%" },
  { src: "/images/muay-thai.jpg", position: "50% 40%" },
];

// Milliseconds: how long each photo stays, and the cross-fade to the next one.
export const LOGIN_TIMING = { interval: 7000, fade: 1500 };

export const IMAGES = {
  hero: HERO_SLIDES[0].src,
  groupTraining: "/images/group-fitness.jpg",
  coaching: "/images/coach-overhead.jpg",
  memberships: "/images/dumbbell-rack.jpg",
  facility: "/images/gym-interior.jpg",
  strength: "/images/coach-curl.jpg",
  mono: "/images/gym-mono.jpg",
};

const toSlug = (str = "") =>
  String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function classThumbnails(...names) {
  const text = names.filter(Boolean).join(" ");

  const hit = RULES.find(([re]) => re.test(text));
  const baseName = hit ? hit[1] : toSlug(text);

  if (!baseName) return [IMAGES.facility, IMAGES.mono];

  return [`/images/${baseName}-Room-1.jpg`, `/images/${baseName}-Room-2.jpg`];
}

// People's photos (coach avatars) are uploaded through the API and live on Cloudinary at full size, up to
// 5 MB each. Ask Cloudinary for a copy cropped to the box the page draws instead: c_fill + g_auto keeps the
// person in frame, q_auto/f_auto pick the quality and format. Other links are returned unchanged.
export function photoUrl(url, width, height = width) {
  const m = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i.exec(url ?? "");
  return m ? `${m[1]}c_fill,g_auto,w_${width},h_${height},q_auto,f_auto/${m[2]}` : url;
}
