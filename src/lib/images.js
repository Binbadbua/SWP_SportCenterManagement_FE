// The API has no image fields for classes or sports, so the UI picks a photo
// from /public/images by matching the sport/class name (English or Vietnamese).
// Photos: Unsplash (free to use, https://unsplash.com/license).

const RULES = [
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

export const IMAGES = {
  hero: "/images/tennis.jpg",
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
