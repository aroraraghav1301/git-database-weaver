import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { execute, splitStatements, type DB, type Result } from "@/lib/braceql";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BraceDB — a database with its own query language" },
      { name: "description", content: "Write BraceQL queries, manage tables, and export your database as a JSON file." },
      { property: "og:title", content: "BraceDB" },
      { property: "og:description", content: "Write BraceQL queries and export your database as JSON." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const SAMPLE = `CREATE TABLE {name: Games; columns: title, year, genre;}
INSERT INTO {table: Games; values: title=Zelda, year=1986, genre=Adventure;}
INSERT INTO {table: Games; values: title=Tetris, year=1984, genre=Puzzle;}
SELECT {table: Games;}`;

const STORAGE = "bracedb";
const empty = (): DB => ({ name: "my_database", tables: {} });

function Index() {
  const [db, setDb] = useState<DB>(empty);
  const [query, setQuery] = useState(SAMPLE);
  const [results, setResults] = useState<{ stmt: string; res: Result }[]>([]);
  const [showJson, setShowJson] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = localStorage.getItem(STORAGE);
    if (s) try { setDb(JSON.parse(s)); } catch { /* ignore */ }
  }, []);

  const save = (d: DB) => { setDb(d); localStorage.setItem(STORAGE, JSON.stringify(d)); };

  const run = () => {
    const next: DB = structuredClone(db);
    const stmts = splitStatements(query);
    const out = stmts.length
      ? stmts.map((stmt) => ({ stmt, res: execute(next, stmt) }))
      : [{ stmt: query, res: { ok: false, message: "No statements found" } }];
    save(next);
    setResults(out);
  };

  const json = JSON.stringify(db, null, 2);

  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${db.name}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const importFile = async (f: File) => {
    try {
      const d = JSON.parse(await f.text());
      if (!d.tables) throw new Error();
      save(d);
      setResults([{ stmt: f.name, res: { ok: true, message: "Database imported" } }]);
    } catch {
      setResults([{ stmt: f.name, res: { ok: false, message: "Invalid database JSON file" } }]);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <header className="border-b border-border px-6 py-4 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <span className="text-primary text-2xl font-bold">{"{ }"}</span>
          <h1 className="text-xl font-bold tracking-tight">BraceDB</h1>
          <input
            value={db.name}
            onChange={(e) => save({ ...db, name: e.target.value.replace(/\s+/g, "_") })}
            className="bg-card border border-border rounded px-2 py-1 text-sm w-44"
            aria-label="Database name"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <button className="btn-ghost" onClick={() => { if (confirm("Clear the whole database?")) { save(empty()); setResults([]); } }}>Reset</button>
          <button className="btn-primary" onClick={() => setShowJson(true)}>Get JSON file</button>
        </div>
      </header>

      <main className="grid lg:grid-cols-[1fr_280px] gap-6 p-6">
        <section className="space-y-4 min-w-0">
          <div className="panel">
            <div className="panel-head">
              <span>query.bql</span>
              <button className="btn-primary" onClick={run}>Run ▶</button>
            </div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run(); }}
              spellCheck={false}
              className="w-full h-56 bg-transparent p-4 text-sm outline-none resize-y text-primary"
            />
            <p className="px-4 pb-3 text-xs text-muted-foreground">Ctrl/Cmd + Enter to run</p>
          </div>

          {results.map(({ stmt, res }, i) => (
            <div key={i} className="panel">
              <div className="panel-head">
                <span className="truncate text-muted-foreground">{stmt}</span>
                <span className={res.ok ? "text-primary" : "text-destructive"}>{res.message}</span>
              </div>
              {res.rows && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr>{res.columns?.map((c) => <th key={c} className="text-left px-4 py-2 border-b border-border text-muted-foreground">{c}</th>)}</tr></thead>
                    <tbody>
                      {res.rows.map((r, j) => (
                        <tr key={j} className="border-b border-border/50">
                          {res.columns?.map((c) => <td key={c} className="px-4 py-2">{String(r[c] ?? "—")}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </section>

        <aside className="space-y-4">
          <div className="panel p-4">
            <h2 className="text-xs uppercase text-muted-foreground mb-2">Tables</h2>
            {Object.keys(db.tables).length === 0 && <p className="text-sm text-muted-foreground">None yet</p>}
            {Object.entries(db.tables).map(([n, t]) => (
              <button key={n} className="block w-full text-left text-sm py-1 hover:text-primary" onClick={() => setQuery(`SELECT {table: ${n};}`)}>
                ▸ {n} <span className="text-muted-foreground">({t.rows.length})</span>
              </button>
            ))}
          </div>
          <div className="panel p-4 text-xs space-y-2 text-muted-foreground">
            <h2 className="uppercase mb-2">BraceQL syntax</h2>
            {[
              "CREATE TABLE {name: Games; columns: title, year;}",
              "INSERT INTO {table: Games; values: title=Zelda, year=1986;}",
              "SELECT {table: Games; where: year=1986; limit: 10;}",
              "UPDATE {table: Games; set: year=1987; where: title=Zelda;}",
              "DELETE FROM {table: Games; where: title=Zelda;}",
              "DROP TABLE {name: Games;}",
              "SHOW TABLES {}",
            ].map((s) => <code key={s} className="block text-foreground/80 break-words">{s}</code>)}
          </div>
        </aside>
      </main>

      {showJson && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur flex items-center justify-center p-4 z-50" onClick={() => setShowJson(false)}>
          <div className="panel w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <span>{db.name}.json</span>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(json)}>Copy</button>
                <button className="btn-primary" onClick={download}>Download</button>
                <button className="btn-ghost" onClick={() => setShowJson(false)}>✕</button>
              </div>
            </div>
            <pre className="overflow-auto p-4 text-xs text-primary">{json}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
