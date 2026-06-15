# Calculate Round of 32 Matchups Example Functions
In Schedule C74:
=IF('Knockout Bracket'!$I$6, 'Live Standings'!B4, IF(Standings!C4=3, Standings!B4, "[2A]"))

In Schdule F76:
=LET(comb, INDEX(third_place_combinations!Q:Q, MATCH('3rd_Place_Rankings'!$L$1, third_place_combinations!$V:$V, 0)), team, IF('Knockout Bracket'!$I$6, SWITCH(comb, "3A", 'Live Standings'!B5, "3B", 'Live Standings'!B12, "3C", 'Live Standings'!B19, "3D", 'Live Standings'!B26, "3E", 'Live Standings'!B33, "3F", 'Live Standings'!B40, "3G", 'Live Standings'!B47, "3H", 'Live Standings'!B54, "3I", 'Live Standings'!B61, "3J", 'Live Standings'!B68, "3K", 'Live Standings'!B75, "3L", 'Live Standings'!B82, comb), SWITCH(comb, "3A", Standings!B5, "3B", Standings!B12, "3C", Standings!B19, "3D", Standings!B26, "3E", Standings!B33, "3F", Standings!B40, "3G", Standings!B47, "3H", Standings!B54, "3I", Standings!B61, "3J", Standings!B68, "3K", Standings!B75, "3L", Standings!B82, comb)), mp, SWITCH(comb, "3A", Standings!C5, "3B", Standings!C12, "3C", Standings!C19, "3D", Standings!C26, "3E", Standings!C33, "3F", Standings!C40, "3G", Standings!C47, "3H", Standings!C54, "3I", Standings!C61, "3J", Standings!C68, "3K", Standings!C75, "3L", Standings!C82, 0), IF(OR(mp=3, 'Knockout Bracket'!$I$6), team, "[3ABCDF]"))

# Third Place Table function
=IF('Knockout Bracket'!$I$6, SORT(FILTER('Live Standings'!A:J, 'Live Standings'!A:A=3), 10, FALSE, 9, FALSE, 7, FALSE), SORT(FILTER(Standings!A:J, Standings!A:A=3), 10, FALSE, 9, FALSE, 7, FALSE))
