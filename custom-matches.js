window.ANAWAR_HEIN_CONTENT = {
  items: [
    ["Chelsea", "Manchester United", "EPL", "2026-10-31T19:00:00+06:30", "363", "360", "https://example.com/stream-01.m3u8"],

    ["Levante", "Atlético Madrid", "LaLiga", "2026-10-31T19:30:00+06:30", "1538", "1068", "https://example.com/stream-02.m3u8"],

    ["Bologna", "Monza", "Serie A", "2026-10-31T20:30:00+06:30", "107", "4007", "https://example.com/stream-03.m3u8"],

    ["Bayer Leverkusen", "VfB Stuttgart", "Bundesliga", "2026-10-31T21:00:00+06:30", "131", "134", "https://example.com/stream-04.m3u8"],

    ["Borussia Mönchengladbach", "SC Paderborn 07", "Bundesliga", "2026-10-31T21:00:00+06:30", "268", "3307", "https://example.com/stream-05.m3u8"],

    ["FC Augsburg", "SC Freiburg", "Bundesliga", "2026-10-31T21:00:00+06:30", "3841", "126", "https://example.com/stream-06.m3u8"],

    ["Schalke 04", "RB Leipzig", "Bundesliga", "2026-10-31T21:00:00+06:30", "133", "11420", "https://example.com/stream-07.m3u8"],

    ["Werder Bremen", "TSG Hoffenheim", "Bundesliga", "2026-10-31T21:00:00+06:30", "137", "7911", "https://example.com/stream-08.m3u8"],

    ["AFC Bournemouth", "Leeds United", "EPL", "2026-10-31T21:30:00+06:30", "349", "357", "https://example.com/stream-09.m3u8"],

    ["Brentford", "Nottingham Forest", "EPL", "2026-10-31T21:30:00+06:30", "337", "393", "https://example.com/stream-10.m3u8"],

    ["Coventry City", "Sunderland", "EPL", "2026-10-31T21:30:00+06:30", "388", "366", "https://example.com/stream-11.m3u8"],

    ["Hull City", "Ipswich Town", "EPL", "2026-10-31T21:30:00+06:30", "306", "373", "https://example.com/stream-12.m3u8"],

    ["Manchester City", "Brighton & Hove Albion", "EPL", "2026-10-31T21:30:00+06:30", "382", "331", "https://example.com/stream-13.m3u8"],

    ["Rayo Vallecano", "Celta Vigo", "LaLiga", "2026-10-31T21:45:00+06:30", "101", "85", "https://example.com/stream-14.m3u8"],

    ["Udinese", "AS Roma", "Serie A", "2026-10-31T23:30:00+06:30", "118", "104", "https://example.com/stream-15.m3u8"],

    ["Tottenham Hotspur", "Crystal Palace", "EPL", "2026-11-01T00:00:00+06:30", "367", "384", "https://example.com/stream-16.m3u8"],

    ["Real Betis", "Málaga", "LaLiga", "2026-11-01T00:00:00+06:30", "244", "99", "https://example.com/stream-17.m3u8"],

    ["Bayern Munich", "Borussia Dortmund", "Bundesliga", "2026-11-01T00:00:00+06:30", "132", "124", "https://example.com/stream-18.m3u8"],

    ["Troyes", "Le Mans", "Ligue 1", "2026-11-01T02:15:00+06:30", "170", "2697", "https://example.com/stream-19.m3u8"],

    ["AC Milan", "Inter Milan", "Serie A", "2026-11-01T02:15:00+06:30", "103", "110", "https://example.com/stream-20.m3u8"],

    ["Aston Villa", "Fulham", "EPL", "2026-11-01T02:30:00+06:30", "362", "370", "https://example.com/stream-21.m3u8"],

    ["Barcelona", "Alavés", "LaLiga", "2026-11-01T02:30:00+06:30", "83", "96", "https://example.com/stream-22.m3u8"]
  ].map(function (match, index) {
    return {
      id: "anawar-20261031-" + String(index + 1).padStart(2, "0"),
      category: "anawar",
      title: match[0] + " vs " + match[1],
      home: match[0],
      away: match[1],
      league: match[2],
      startAt: match[3],
      timeZone: "Asia/Yangon",
      statusMode: "auto",
      homeLogo: "https://a.espncdn.com/i/teamlogos/soccer/500/" + match[4] + ".png",
      awayLogo: "https://a.espncdn.com/i/teamlogos/soccer/500/" + match[5] + ".png",
      homeScore: "",
      awayScore: "",
      kind: "video",
      url: match[6],
      streams: [
        {
          label: "Server 1",
          kind: "video",
          url: match[6]
        }
      ]
    };
  })
};
