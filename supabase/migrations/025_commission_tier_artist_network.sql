-- New enum value only (must commit before use in UPDATE — see 026).

alter type commission_tier add value if not exists 'artist_network';
