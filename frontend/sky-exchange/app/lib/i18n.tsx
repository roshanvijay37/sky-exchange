"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "en" | "hi" | "kn";

const translations: Record<Lang, Record<string, string>> = {
  en: {
    // Nav
    matches: "Matches",
    myBets: "My Bets",
    admin: "Admin",
    login: "Login",
    logout: "Logout",
    // Home
    liveUpcoming: "Live & Upcoming Matches",
    noMatches: "No matches available",
    upcoming: "UPCOMING",
    live: "LIVE",
    completed: "COMPLETED",
    // Match
    whoWillWin: "Who will win?",
    bet: "Bet",
    win: "Win",
    enterAmount: "Enter your bet amount",
    placeBet: "Place Bet",
    confirmBet: "Confirm your bet?",
    confirm: "Confirm",
    cancel: "Cancel",
    youBet: "You bet",
    ifYouWin: "If you win",
    ifYouLose: "If you lose",
    profit: "profit",
    ifWrongLose: "If wrong, you lose",
    betMatched: "Bet matched!",
    betPlaced: "Bet placed — waiting for someone to take the other side.",
    on: "on",
    winProfit: "win profit!",
    suspended: "MARKET SUSPENDED — Betting is paused",
    matchLocked: "Not accepting bets right now",
    availableBets: "Available bets from other users",
    available: "available",
    per: "per",
    loading: "Loading...",
    // Positions
    myPositions: "My Positions",
    balance: "Balance",
    openOrders: "Open Orders",
    tradeHistory: "Trade History",
    outcome: "Outcome",
    side: "Side",
    price: "Price",
    stake: "Stake",
    status: "Status",
    time: "Time",
    match: "Match",
    pnl: "P&L",
    open: "Open",
    noOrders: "No orders yet. Go place some bets!",
    noTrades: "No matched trades yet.",
    cancelOrder: "Cancel",
    // Login
    createAccount: "Create Account",
    username: "Username",
    password: "Password",
    register: "Register",
    alreadyHaveAccount: "Already have an account?",
    dontHaveAccount: "Don't have an account?",
  },
  hi: {
    matches: "मैच",
    myBets: "मेरे दांव",
    admin: "एडमिन",
    login: "लॉगिन",
    logout: "लॉगआउट",
    liveUpcoming: "लाइव और आगामी मैच",
    noMatches: "कोई मैच उपलब्ध नहीं",
    upcoming: "आगामी",
    live: "लाइव",
    completed: "पूरा हुआ",
    whoWillWin: "कौन जीतेगा?",
    bet: "दांव",
    win: "जीत",
    enterAmount: "अपनी दांव राशि डालें",
    placeBet: "दांव लगाओ",
    confirmBet: "दांव पक्का करें?",
    confirm: "पक्का करो",
    cancel: "रद्द करो",
    youBet: "आपका दांव",
    ifYouWin: "अगर आप जीते",
    ifYouLose: "अगर आप हारे",
    profit: "मुनाफा",
    ifWrongLose: "गलत हुआ तो नुकसान",
    betMatched: "दांव लग गया!",
    betPlaced: "दांव लगा — किसी के स्वीकार करने का इंतज़ार।",
    on: "पर",
    winProfit: "मुनाफा!",
    suspended: "बाज़ार रुका हुआ है — दांव बंद है",
    matchLocked: "अभी दांव स्वीकार नहीं हो रहे",
    availableBets: "दूसरे खिलाड़ियों के दांव",
    available: "उपलब्ध",
    per: "प्रति",
    loading: "लोड हो रहा है...",
    myPositions: "मेरे दांव",
    balance: "बैलेंस",
    openOrders: "खुले ऑर्डर",
    tradeHistory: "दांव इतिहास",
    outcome: "नतीजा",
    side: "पक्ष",
    price: "दाम",
    stake: "दांव",
    status: "स्थिति",
    time: "समय",
    match: "मैच",
    pnl: "फायदा/नुकसान",
    open: "खुला",
    noOrders: "कोई ऑर्डर नहीं। जाओ दांव लगाओ!",
    noTrades: "कोई दांव नहीं लगा अभी।",
    cancelOrder: "रद्द करो",
    createAccount: "खाता बनाओ",
    username: "यूज़रनेम",
    password: "पासवर्ड",
    register: "रजिस्टर",
    alreadyHaveAccount: "पहले से खाता है?",
    dontHaveAccount: "खाता नहीं है?",
  },
  kn: {
    matches: "ಪಂದ್ಯಗಳು",
    myBets: "ನನ್ನ ಬೆಟ್‌ಗಳು",
    admin: "ಅಡ್ಮಿನ್",
    login: "ಲಾಗಿನ್",
    logout: "ಲಾಗ್‌ಔಟ್",
    liveUpcoming: "ಲೈವ್ ಮತ್ತು ಮುಂಬರುವ ಪಂದ್ಯಗಳು",
    noMatches: "ಯಾವುದೇ ಪಂದ್ಯಗಳಿಲ್ಲ",
    upcoming: "ಮುಂಬರುವ",
    live: "ಲೈವ್",
    completed: "ಮುಗಿದಿದೆ",
    whoWillWin: "ಯಾರು ಗೆಲ್ಲುತ್ತಾರೆ?",
    bet: "ಬೆಟ್",
    win: "ಗೆಲುವು",
    enterAmount: "ನಿಮ್ಮ ಬೆಟ್ ಮೊತ್ತ ನಮೂದಿಸಿ",
    placeBet: "ಬೆಟ್ ಇಡಿ",
    confirmBet: "ಬೆಟ್ ಖಚಿತಪಡಿಸಿ?",
    confirm: "ಖಚಿತಪಡಿಸಿ",
    cancel: "ರದ್ದು ಮಾಡಿ",
    youBet: "ನಿಮ್ಮ ಬೆಟ್",
    ifYouWin: "ನೀವು ಗೆದ್ದರೆ",
    ifYouLose: "ನೀವು ಸೋತರೆ",
    profit: "ಲಾಭ",
    ifWrongLose: "ತಪ್ಪಾದರೆ ನಷ್ಟ",
    betMatched: "ಬೆಟ್ ಆಯಿತು!",
    betPlaced: "ಬೆಟ್ ಇಟ್ಟಿದೆ — ಯಾರಾದರೂ ಸ್ವೀಕರಿಸುವ ತನಕ ಕಾಯಿರಿ.",
    on: "ಮೇಲೆ",
    winProfit: "ಲಾಭ!",
    suspended: "ಮಾರುಕಟ್ಟೆ ನಿಂತಿದೆ — ಬೆಟ್ ಮಾಡಲು ಸಾಧ್ಯವಿಲ್ಲ",
    matchLocked: "ಈಗ ಬೆಟ್ ಸ್ವೀಕರಿಸುತ್ತಿಲ್ಲ",
    availableBets: "ಇತರ ಆಟಗಾರರ ಬೆಟ್‌ಗಳು",
    available: "ಲಭ್ಯ",
    per: "ಪ್ರತಿ",
    loading: "ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
    myPositions: "ನನ್ನ ಬೆಟ್‌ಗಳು",
    balance: "ಬ್ಯಾಲೆನ್ಸ್",
    openOrders: "ತೆರೆದ ಆರ್ಡರ್‌ಗಳು",
    tradeHistory: "ಬೆಟ್ ಇತಿಹಾಸ",
    outcome: "ಫಲಿತಾಂಶ",
    side: "ಕಡೆ",
    price: "ಬೆಲೆ",
    stake: "ಬೆಟ್",
    status: "ಸ್ಥಿತಿ",
    time: "ಸಮಯ",
    match: "ಪಂದ್ಯ",
    pnl: "ಲಾಭ/ನಷ್ಟ",
    open: "ತೆರೆದಿದೆ",
    noOrders: "ಯಾವುದೇ ಆರ್ಡರ್ ಇಲ್ಲ. ಬೆಟ್ ಇಡಿ!",
    noTrades: "ಯಾವುದೇ ಬೆಟ್ ಆಗಿಲ್ಲ.",
    cancelOrder: "ರದ್ದು ಮಾಡಿ",
    createAccount: "ಖಾತೆ ತೆರೆಯಿರಿ",
    username: "ಯೂಸರ್‌ನೇಮ್",
    password: "ಪಾಸ್‌ವರ್ಡ್",
    register: "ನೋಂದಣಿ",
    alreadyHaveAccount: "ಈಗಾಗಲೇ ಖಾತೆ ಇದೆಯೇ?",
    dontHaveAccount: "ಖಾತೆ ಇಲ್ಲವೇ?",
  },
};

const langLabels: Record<Lang, string> = { en: "EN", hi: "हिं", kn: "ಕನ್" };

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  langLabels: Record<Lang, string>;
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
  langLabels,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved && translations[saved]) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
  };

  const t = (key: string) => translations[lang][key] || translations.en[key] || key;

  return (
    <I18nContext.Provider value={{ lang, setLang, t, langLabels }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
