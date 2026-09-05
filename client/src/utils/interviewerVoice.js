const FEMALE_VOICE_HINTS = [
    "samantha", "victoria", "karen", "moira", "tessa", "ava", "allison",
    "susan", "serena", "fiona", "veena", "zira", "aria", "jenny", "sonia",
    "michelle", "emma", "natasha", "libby", "hazel", "heera", "priya",
];

const MALE_VOICE_HINTS = [
    "alex", "daniel", "oliver", "fred", "tom", "rishi", "lee", "aaron",
    "guy", "ryan", "mark", "david", "george", "james", "brian", "ravi",
];

const matchesHint = (voice, hints) => {
    const name = `${voice?.name || ""} ${voice?.voiceURI || ""}`.toLowerCase();
    return hints.some((hint) => name.includes(hint));
};

export const chooseInterviewerGender = (random = Math.random) => random() < 0.5 ? "female" : "male";

export const interviewerPitchForGender = (gender) => gender === "female" ? 1.06 : 0.94;

export const selectInterviewerVoice = (voices = [], gender = "female") => {
    const englishVoices = (Array.isArray(voices) ? voices : [])
        .filter((voice) => (voice?.lang || "").toLowerCase().startsWith("en"));
    if (!englishVoices.length) return null;

    const hints = gender === "female" ? FEMALE_VOICE_HINTS : MALE_VOICE_HINTS;
    const genderMatch = englishVoices.find((voice) => matchesHint(voice, hints));
    if (genderMatch) return genderMatch;

    const googleEnglish = englishVoices.find((voice) => (voice?.name || "").toLowerCase().includes("google"));
    return googleEnglish || englishVoices[0] || null;
};
