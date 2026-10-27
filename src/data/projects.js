// Projects stored locally in the repo (not in Supabase).
// They are merged with the Supabase projects in Pages/Portofolio.jsx.
const localProjects = [
  {
    id: "local-masatoshi-studio",
    Title: "Masatoshi Studio",
    Description:
      "ហាងលក់ផលិតផលឌីជីថលតាមអ៊ីនធឺណិត ដែលអ្នកប្រើអាចទិញ និងទាញយកផលិតផលដោយប្រើពិន្ទុ។ មានប្រព័ន្ធបញ្ចូលពិន្ទុតាម Bakong KHQR, ABA, Wing និង PayWay, ចូលប្រើតាម Google, ភាសាខ្មែរ/អង់គ្លេស និងផ្ទាំងគ្រប់គ្រង (Admin) ពេញលេញ។",
    Img: "/projects/masatoshi-studio.jpg",
    Link: "",
    Github: "https://github.com/heng604/tester",
    TechStack: ["React", "Vite", "Node.js", "Express", "MongoDB", "Firebase", "Bakong KHQR", "PayWay"],
    Features: [
      "ទិញ និងទាញយកផលិតផលឌីជីថលដោយប្រើប្រព័ន្ធពិន្ទុ",
      "បញ្ចូលពិន្ទុតាម Bakong KHQR (ផ្ទៀងផ្ទាត់ស្វ័យប្រវត្តិ), ABA, Wing និង PayWay",
      "ចូលគណនីតាម Google និងទំព័រប្រវត្តិរូបអ្នកប្រើ",
      "ប្តូរភាសាបាន ខ្មែរ ↔ អង់គ្លេស",
      "ផ្ទាំង Admin: គ្រប់គ្រងផលិតផល, ការបញ្ជាទិញ, ការបញ្ចូលពិន្ទុ, អ្នកប្រើ, បដា និងរបាយការណ៍",
      "នាំចេញរបាយការណ៍ និងស្ថិតិផ្ទាំងគ្រប់គ្រង",
    ],
  },
  {
    id: "local-spotify-esp32",
    Title: "Spotify OLED Display ESP32",
    Description:
      "បង្ហាញចម្រៀងដែលកំពុងចាក់លើ Spotify ភ្លាមៗលើអេក្រង់ OLED 1.3\" (SH1106 128×64) ជាមួយ lyrics ដែលស៊ីងក្រូនជាមួយភ្លេង, ប្រព័ន្ធទឹកមុខពេលទំនេរ, របារដំណើរការចម្រៀង និង equalizer។ ប្រើ Discord Bot (Python) អាន Rich Presence ហើយផ្ញើទិន្នន័យតាម HTTP JSON API ទៅ ESP32។",
    Img: "/projects/spotify-esp32.svg",
    Link: "",
    Github: "https://github.com/heng604/Spotify-ESP32",
    TechStack: ["ESP32", "Arduino C++", "Python", "discord.py", "aiohttp", "SH1106 OLED", "lrclib API"],
    Features: [
      "បង្ហាញចម្រៀង និងអ្នកចម្រៀងដែលកំពុងចាក់ពី Spotify ភ្លាមៗ",
      "Lyrics ស៊ីងក្រូនជាមួយភ្លេង ទាញពី lrclib.net (មិនត្រូវការ API key)",
      "របារដំណើរការចម្រៀង និង equalizer លើអេក្រង់ OLED",
      "ទឹកមុខ/ចលនាពេលទំនេរ នៅពេលមិនមានចម្រៀងកំពុងចាក់",
      "ESP32 ទាញទិន្នន័យពី endpoint /now-playing រៀងរាល់ 2 វិនាទី",
      "ដាក់ពង្រាយលើ VPS ដើម្បីដំណើរការ 24/7 បាន",
    ],
  },
];

// Combine local projects with remote (Supabase) ones, skipping duplicates by title.
export const mergeProjects = (remote = []) => {
  const remoteTitles = new Set(remote.map((p) => (p.Title || "").toLowerCase()));
  const extras = localProjects.filter(
    (p) => !remoteTitles.has(p.Title.toLowerCase())
  );
  return [...extras, ...remote];
};

export default localProjects;
