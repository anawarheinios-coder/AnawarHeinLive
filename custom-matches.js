window.ANAWAR_HEIN_CONTENT = {
  items: (window.ARYONE_FOOTBALL_MATCHES || []).map(
    function (match, index) {
      return Object.assign({}, match, {
        id: match.id || "anawar-" + (index + 1),
        category: "anawar",
        title: match.title || match.home + " vs " + match.away,
        startAt: match.startAt || match.kickoff,
        timeZone: "Asia/Yangon",
        statusMode: match.statusMode || match.status || "auto",
        kind: match.kind || "video",
        streams:
          match.streams && match.streams.length
            ? match.streams
            : [
                {
                  label: "Server 1",
                  kind: match.kind || "video",
                  url: match.url
                }
              ]
      });
    }
  )
};
