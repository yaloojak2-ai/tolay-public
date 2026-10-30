// Public by design: the anon key only grants what the database's row-level security allows.
window.TOLAY = {
  url: "https://rsdzacaklgpdrccwwjqv.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzZHphY2FrbGdwZHJjY3d3anF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzODYzODcsImV4cCI6MjEwODk2MjM4N30.m8pGzQmsKqsBSoi1L2CZTz7e-DFCL744pvFjDcdMEAY"
};
window.db = supabase.createClient(TOLAY.url, TOLAY.key);
