/**
 * "Export from Canvas" bookmarklet.
 *
 * Runs on a Canvas page the student is already signed in to and calls the
 * Canvas REST API on that same site with the existing login (no token). It
 * only reads the student's own active courses, assignment groups, assignments
 * and their own submissions, then downloads them as a JSON file for UniOS.
 * Nothing is sent anywhere else.
 *
 * Kept as a plain string (not a compiled function) so the bundler can't
 * inject helpers that wouldn't exist on the Canvas page.
 */
export const CANVAS_EXPORT_VERSION = 1;

const SOURCE = `(async () => {
  if (!window.ENV || !document.querySelector('#application, #content')) {
    alert('UniOS: open your Canvas site (signed in) and click this bookmark there.');
    return;
  }
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:99999;right:16px;bottom:16px;padding:12px 16px;background:#18242b;color:#f5f3ed;font:13px/1.4 system-ui,sans-serif;border-radius:4px;box-shadow:0 8px 24px rgba(0,0,0,.25)';
  box.textContent = 'UniOS: reading your courses…';
  document.body.appendChild(box);
  const all = async (url) => {
    let out = [];
    while (url) {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      if (!r.ok) throw new Error(r.status + ' on ' + url.split('?')[0]);
      out = out.concat(await r.json());
      const m = /<([^>]+)>;\\s*rel="next"/.exec(r.headers.get('Link') || '');
      url = m ? m[1] : null;
    }
    return out;
  };
  const strip = (h) => (h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 2000);
  try {
    const courses = await all('/api/v1/courses?enrollment_state=active&include[]=term&per_page=100');
    const out = { source: 'canvas-export', version: ${CANVAS_EXPORT_VERSION}, host: location.host, exportedAt: new Date().toISOString(), courses: [] };
    let i = 0;
    for (const c of courses) {
      i++;
      if (!c || !c.name || c.access_restricted_by_date) continue;
      box.textContent = 'UniOS: ' + (c.course_code || c.name) + ' (' + i + '/' + courses.length + ')…';
      let groups = [];
      try {
        groups = await all('/api/v1/courses/' + c.id + '/assignment_groups?include[]=assignments&include[]=submission&per_page=100');
      } catch (e) { /* course without visible assignments */ }
      out.courses.push({
        id: String(c.id), name: c.name, code: c.course_code || '', term: (c.term && c.term.name) || null,
        start: c.start_at || null, end: c.end_at || null, weighted: !!c.apply_assignment_group_weights,
        url: location.origin + '/courses/' + c.id,
        groups: groups.map((g) => ({
          id: String(g.id), name: g.name || 'Assignments', weight: g.group_weight || 0,
          dropLowest: (g.rules && g.rules.drop_lowest) || 0,
          assignments: (g.assignments || []).map((a) => {
            const s = a.submission || {};
            return {
              id: String(a.id), name: a.name, due: a.due_at || null, points: a.points_possible || 0,
              url: a.html_url || null, description: strip(a.description), types: a.submission_types || [],
              omit: !!a.omit_from_final_grade, published: a.published !== false,
              score: s.score === undefined ? null : s.score, graded: s.workflow_state === 'graded',
              excused: !!s.excused, missing: !!s.missing, submitted: !!s.submitted_at
            };
          })
        }))
      });
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'canvas-export-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    box.textContent = 'UniOS: exported ' + out.courses.length + ' courses. Import the downloaded file in UniOS → Settings → Canvas.';
    setTimeout(() => box.remove(), 8000);
  } catch (e) {
    box.textContent = 'UniOS export failed: ' + e.message;
    setTimeout(() => box.remove(), 10000);
  }
})();`;

export const bookmarkletSource = SOURCE;
export const bookmarkletHref = `javascript:${encodeURIComponent(SOURCE.replace(/\n\s*/g, " "))}`;
