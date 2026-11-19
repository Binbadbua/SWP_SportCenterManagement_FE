

// Photos: Unsplash (https://unsplash.com/license) and Wikimedia Commons — see public/images/CREDITS.md.

const RULES = [
  [/yoga thư giãn cuối ngày/i, "yoga-evening-demo"],
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

export const HERO_SLIDES = [
  { src: "/images/tennis.jpg", alt: "Nhìn từ trên cao một người chơi tennis đang giao bóng trên sân đất nện", position: "60% 40%", title: ["Đến lượt", "bạn."] },
  { src: "/images/yoga.jpg", alt: "Lớp yoga lúc bình minh", position: "center 40%", title: ["Hít thở", "thật sâu."] },
  { src: "/images/swimming.jpg", alt: "Vận động viên bơi bướm trong làn bơi", position: "center 45%", title: ["Bơi xa", "hơn nữa."] },
  { src: "/images/hiit-ropes.jpg", alt: "Vận động viên tập với dây thừng chiến đấu", position: "70% center", title: ["Đốt cháy", "giới hạn."] },
  { src: "/images/basketball.jpg", alt: "Quả bóng rổ rơi qua vành rổ", position: "center 30%", title: ["Ghi điểm", "mỗi ngày."] },
];

export const HERO_TIMING = { interval: 7000, fade: 1200 };

export const LOGIN_SLIDES = [
  { src: "/images/deadlift.jpg", position: "55% 40%" },
  { src: "/images/climbing.jpg", position: "65% 40%" },
  { src: "/images/running.jpg", position: "45% 50%" },
  { src: "/images/muay-thai.jpg", position: "50% 40%" },
];

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

export function photoUrl(url, width, height = width) {
  const m = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i.exec(url ?? "");
  return m ? `${m[1]}c_fill,g_auto,w_${width},h_${height},q_auto,f_auto/${m[2]}` : url;
}
