/**
 * MyUB Academic helpers — goals, CA marks, what-if, alerts, transcript PDF
 */
(function (global) {
    'use strict';

    var GOAL_KEY = 'myub_gpa_goal';
    var CA_KEY = 'myub_course_ca';
    var ALERT_KEY = 'myub_academic_alerts';

    function lsGet(key, fallback) {
        try {
            var raw = global.localStorage.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (_) {
            return fallback;
        }
    }

    function lsSet(key, value) {
        try {
            global.localStorage.setItem(key, JSON.stringify(value));
        } catch (_) {}
    }

    function getGoal() {
        return lsGet(GOAL_KEY, null);
    }

    function setGoalLocal(goal) {
        lsSet(GOAL_KEY, goal);
        return goal;
    }

    async function loadGoal(supabase, userId) {
        var local = getGoal();
        if (!supabase || !userId) return local;
        try {
            var res = await supabase.from('profiles').select('gpa_goal').eq('id', userId).maybeSingle();
            if (res.data && res.data.gpa_goal != null) {
                var goal = { target: parseFloat(res.data.gpa_goal), updatedAt: Date.now() };
                setGoalLocal(goal);
                return goal;
            }
        } catch (_) {}
        return local;
    }

    async function saveGoal(supabase, userId, target) {
        var goal = { target: parseFloat(target), updatedAt: Date.now() };
        setGoalLocal(goal);
        if (supabase && userId) {
            try {
                await supabase.from('profiles').update({ gpa_goal: goal.target }).eq('id', userId);
            } catch (_) {}
        }
        return goal;
    }

    function getAllCA() {
        return lsGet(CA_KEY, {}) || {};
    }

    function getCourseCA(courseId) {
        var all = getAllCA();
        return all[courseId] || null;
    }

    function setCourseCA(courseId, data) {
        var all = getAllCA();
        all[courseId] = data;
        lsSet(CA_KEY, all);
        return data;
    }

    function mergeCourseCA(courses) {
        var all = getAllCA();
        return (courses || []).map(function (c) {
            var ca = all[c.id];
            if (!ca) return c;
            return Object.assign({}, c, { ca: ca });
        });
    }

    function goalProgress(gpa, goal) {
        if (!goal || !goal.target) return { met: false, gap: null, pct: 0 };
        var target = parseFloat(goal.target) || 0;
        var current = parseFloat(gpa) || 0;
        var met = current >= target;
        var gap = Math.max(0, target - current);
        var pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
        return { met: met, gap: gap, pct: pct, target: target, current: current };
    }

    function whatIfGPA(existingCourses, scenarioCourses) {
        var combined = (existingCourses || []).concat(scenarioCourses || []);
        return MyUBGPA.calculateGPA(combined);
    }

    function renderWhatIfPanel(container, existingCourses, onUpdate) {
        if (!container) return;
        var courseRef = existingCourses || [];
        var rows = [];
        var id = 0;
        var removeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
        var addIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>';
        var calcIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v6"/><path d="m8 7 4-4 4 4"/><path d="M6 14h4"/><path d="M14 14h4"/><path d="M6 18h4"/><path d="M14 18h4"/><rect x="3" y="10" width="18" height="11" rx="2"/></svg>';

        function toggleEmpty() {
            var empty = container.querySelector('.whatif-empty');
            var list = container.querySelector('.whatif-rows');
            if (!empty || !list) return;
            empty.classList.toggle('hidden', list.children.length > 0);
        }

        function sync() {
            var hypo = rows.map(function (r) {
                return { credits: r.credits, grade: r.grade };
            }).filter(function (r) { return r.grade && r.credits; });
            var current = MyUBGPA.calculateGPA(courseRef);
            var projected = whatIfGPA(courseRef, hypo);
            var delta = projected - current;
            var currentEl = container.querySelector('.whatif-current');
            var projectedEl = container.querySelector('.whatif-projected');
            if (currentEl) currentEl.textContent = MyUBGPA.formatGPA(current);
            if (projectedEl) projectedEl.textContent = MyUBGPA.formatGPA(projected);
            var deltaEl = container.querySelector('.whatif-delta');
            if (deltaEl) {
                var sign = delta >= 0 ? '+' : '';
                deltaEl.textContent = sign + delta.toFixed(1);
                deltaEl.className = 'whatif-delta ' + (delta >= 0 ? 'positive' : 'negative');
            }
            var countEl = container.querySelector('.whatif-count');
            if (countEl) {
                countEl.textContent = rows.length + ' scenario' + (rows.length !== 1 ? 's' : '');
            }
            if (onUpdate) onUpdate({ current: current, projected: projected, hypothetical: hypo });
        }

        function gradeOptions(selected) {
            return Object.keys(MyUBGPA.GRADING_SCALE).map(function (g) {
                return '<option value="' + g + '"' + (g === selected ? ' selected' : '') + '>' + g + '</option>';
            }).join('');
        }

        function addRow() {
            var rowId = ++id;
            rows.push({ id: rowId, credits: 3, grade: 'B' });
            var list = container.querySelector('.whatif-rows');
            var div = document.createElement('div');
            div.className = 'whatif-row';
            div.dataset.rowId = String(rowId);
            div.innerHTML =
                '<div class="whatif-field whatif-field-code"><label>Course</label>' +
                '<input type="text" placeholder="e.g. CSI 413" class="whatif-code" autocomplete="off"></div>' +
                '<div class="whatif-field whatif-field-credits"><label>Credits</label>' +
                '<input type="number" class="whatif-credits" value="3" min="1" max="12"></div>' +
                '<div class="whatif-field whatif-field-grade"><label>Expected grade</label>' +
                '<select class="whatif-grade">' + gradeOptions('B') + '</select></div>' +
                '<button type="button" class="whatif-remove" aria-label="Remove scenario">' + removeIcon + '</button>';
            list.appendChild(div);
            div.querySelector('.whatif-credits').addEventListener('input', function () {
                var r = rows.find(function (x) { return x.id === rowId; });
                if (r) r.credits = parseInt(this.value, 10) || 1;
                sync();
            });
            div.querySelector('.whatif-grade').addEventListener('change', function () {
                var r = rows.find(function (x) { return x.id === rowId; });
                if (r) r.grade = this.value;
                sync();
            });
            div.querySelector('.whatif-remove').addEventListener('click', function () {
                rows = rows.filter(function (x) { return x.id !== rowId; });
                div.remove();
                toggleEmpty();
                sync();
            });
            toggleEmpty();
            sync();
        }

        container.innerHTML =
            '<div class="whatif-layout">' +
            '<div class="whatif-explainer">' +
            '<div class="whatif-explainer-icon">' + calcIcon + '</div>' +
            '<div>' +
            '<h3>What-if GPA Simulator</h3>' +
            '<p>Plan ahead by adding courses you are still taking or expect to take. MyUB calculates your cumulative GPA as if those grades were already on your transcript.</p>' +
            '<ol class="whatif-steps">' +
            '<li>Click <strong>Add scenario course</strong> for each in-progress or upcoming module</li>' +
            '<li>Enter credits and the grade you expect (or hope) to earn</li>' +
            '<li>Watch your projected GPA update — compare it to your current GPA above</li>' +
            '</ol>' +
            '<p class="whatif-note">Scenarios are not saved to your record. Use this before finals to see what grades you need.</p>' +
            '</div></div>' +
            '<div class="whatif-body">' +
            '<div class="whatif-stats">' +
            '<div class="whatif-stat"><span class="label">Current GPA</span><strong class="whatif-current">0.0</strong></div>' +
            '<div class="whatif-stat projected"><span class="label">With scenarios</span><strong class="whatif-projected">0.0</strong></div>' +
            '<div class="whatif-stat"><span class="label">Change</span><strong class="whatif-delta positive">+0.0</strong></div>' +
            '</div>' +
            '<div class="whatif-scenarios">' +
            '<div class="whatif-scenarios-header"><h4>Scenario courses</h4><span class="whatif-count">0 scenarios</span></div>' +
            '<div class="whatif-empty">No scenarios yet. Add a course you are taking this semester to see how it affects your GPA.</div>' +
            '<div class="whatif-rows"></div>' +
            '<button type="button" class="btn btn-secondary whatif-add">' + addIcon + ' Add scenario course</button>' +
            '</div></div></div>';

        container.querySelector('.whatif-add').addEventListener('click', addRow);
        container._whatIfSetCourses = function (next) {
            courseRef = next || [];
            sync();
        };
        sync();
    }

    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function sortSemesterKeys(keys) {
        return keys.slice().sort(function (a, b) {
            var pa = String(a).match(/(\d{4})|Year\s*(\d+)|Semester\s*(\d+)/gi) || [];
            var pb = String(b).match(/(\d{4})|Year\s*(\d+)|Semester\s*(\d+)/gi) || [];
            return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    function countGradedCourses(courses) {
        return (courses || []).filter(function (c) { return !!c.grade; }).length;
    }

    function sumAttemptedCredits(courses) {
        return (courses || []).reduce(function (sum, c) {
            var n = Number(c.credits);
            return sum + (c.grade && isFinite(n) ? n : 0);
        }, 0);
    }

    function resolveProfileName(profile) {
        if (!profile) return '';
        var full = (profile.full_name || '').trim();
        if (full) return full;
        var parts = ((profile.first_name || '') + ' ' + (profile.last_name || '')).trim();
        if (parts) return parts;
        if (profile.username) return String(profile.username);
        if (profile.email) return String(profile.email).split('@')[0];
        return '';
    }

    function logoMarkup() {
        return (
            '<div class="brand-logo" aria-label="MyUB">' +
                '<div class="brand-m-wrap">' +
                    '<div class="brand-cap">' +
                        '<svg viewBox="0 0 100 70" width="42" height="29" aria-hidden="true">' +
                            '<polygon points="50,6 95,24 50,42 5,24" fill="#1a4b8c"/>' +
                            '<circle cx="50" cy="24" r="4.5" fill="#ffffff" stroke="#1a4b8c" stroke-width="1.5"/>' +
                            '<rect x="32" y="38" width="36" height="18" rx="2.5" fill="#1a4b8c"/>' +
                            '<circle cx="78" cy="24" r="4" fill="#c41e3a"/>' +
                            '<path d="M78 28 Q82 44 80 54" stroke="#c41e3a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
                            '<ellipse cx="80" cy="57" rx="5" ry="8" fill="#c41e3a"/>' +
                        '</svg>' +
                    '</div>' +
                    '<span class="brand-m">M</span>' +
                '</div>' +
                '<span class="brand-ub">yUB</span>' +
            '</div>'
        );
    }

    function exportTranscriptPDF(courses, profile) {
        var name = resolveProfileName(profile) || 'Student';
        var program = (profile && profile.program_name) || '';
        var studentId = (profile && (profile.student_id || profile.username)) || '';
        var yearOfStudy = profile && profile.year_of_study ? ('Year ' + profile.year_of_study) : '';
        var programType = profile && profile.program_type ? MyUBGPA.PROGRAM_LABELS[profile.program_type] || profile.program_type : '';
        var email = (profile && profile.email) || '';

        var list = courses || [];
        var gpa = MyUBGPA.calculateGPA(list);
        var cls = MyUBGPA.getClassification(gpa);
        var earned = MyUBGPA.earnedCredits(list);
        var attempted = sumAttemptedCredits(list);
        var totalCourses = countGradedCourses(list);
        var required = MyUBGPA.requiredCreditsForProgram(profile && profile.program_type);
        var grouped = MyUBGPA.groupBySemester(list);
        var semKeys = sortSemesterKeys(Object.keys(grouped));
        var generated = new Date().toLocaleString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        var semesterBlocks = '';
        semKeys.forEach(function (key) {
            var rows = grouped[key] || [];
            var semGpa = MyUBGPA.calculateGPA(rows);
            var semCredits = sumAttemptedCredits(rows);
            var semEarned = MyUBGPA.earnedCredits(rows);
            var semCourses = countGradedCourses(rows);
            var body = '';
            rows.forEach(function (c) {
                body += '<tr>' +
                    '<td class="code">' + escapeHtml(c.course_code || '') + '</td>' +
                    '<td class="course">' + escapeHtml(c.course_name || '') + '</td>' +
                    '<td class="num">' + (c.credits != null ? escapeHtml(c.credits) : '—') + '</td>' +
                    '<td class="grade">' + escapeHtml(c.grade || '—') + '</td>' +
                    '<td class="num">' + (c.grade ? MyUBGPA.getGradePoints(c.grade).toFixed(1) : '—') + '</td>' +
                    '</tr>';
            });
            semesterBlocks +=
                '<section class="semester">' +
                    '<div class="semester-head">' +
                        '<h2>' + escapeHtml(key) + '</h2>' +
                        '<div class="semester-meta">' +
                            '<span><strong>' + MyUBGPA.formatGPA(semGpa) + '</strong> GPA</span>' +
                            '<span>' + semCourses + ' course' + (semCourses === 1 ? '' : 's') + '</span>' +
                            '<span>' + semCredits + ' credits attempted</span>' +
                            '<span>' + semEarned + ' earned</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="table-wrap">' +
                    '<table>' +
                        '<thead><tr><th>Code</th><th>Course</th><th>Credits</th><th>Grade</th><th>Points</th></tr></thead>' +
                        '<tbody>' + (body || '<tr><td colspan="5" class="empty">No courses in this semester</td></tr>') + '</tbody>' +
                    '</table>' +
                    '</div>' +
                '</section>';
        });

        if (!semesterBlocks) {
            semesterBlocks = '<section class="semester"><p class="empty-note">No graded courses yet.</p></section>';
        }

        var html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1">' +
            '<title>MyUB Academic Summary — ' + escapeHtml(name) + '</title>' +
            '<style>' +
            '@page{size:A4;margin:14mm}' +
            '*{box-sizing:border-box}' +
            'body{margin:0;font-family:"Segoe UI",Calibri,Arial,sans-serif;color:#102a43;background:#f4f7fb;line-height:1.45;-webkit-text-size-adjust:100%}' +
            '.sheet{max-width:820px;margin:0 auto;padding:18px 16px 28px;background:#fff}' +
            '.brand{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid #1a4b8c;padding-bottom:14px;margin-bottom:18px}' +
            '.brand-logo{display:inline-flex;align-items:flex-end;gap:4px;line-height:1;font-family:Sora,Outfit,"Segoe UI",sans-serif;user-select:none}' +
            '.brand-m-wrap{position:relative;display:inline-block;line-height:0.82}' +
            '.brand-m{font-size:42px;font-weight:800;color:#1a4b8c;letter-spacing:-0.04em;display:inline-block}' +
            '.brand-ub{font-size:16px;font-weight:700;color:#c41e3a;letter-spacing:0.03em;display:inline-block;line-height:0.85;padding-bottom:4px}' +
            '.brand-cap{position:absolute;top:-14px;left:50%;transform:translateX(-50%) rotate(-6deg);width:42px;height:29px;pointer-events:none}' +
            '.brand-cap svg{width:42px;height:29px;display:block;overflow:visible}' +
            '.brand-sub{font-size:12px;color:#486581;margin-top:8px}' +
            '.doc-title{text-align:right}' +
            '.doc-title h1{margin:0;font-size:18px;color:#1a4b8c}' +
            '.doc-title p{margin:4px 0 0;font-size:11px;color:#627d98}' +
            '.student{display:grid;grid-template-columns:1.4fr 1fr;gap:10px 18px;padding:14px 16px;background:#f7fafc;border:1px solid #d9e2ec;border-radius:12px;margin-bottom:18px}' +
            '.student .label{display:block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#627d98;margin-bottom:2px}' +
            '.student .value{font-size:14px;font-weight:600;color:#102a43;word-break:break-word}' +
            '.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:22px}' +
            '.stat{border:1px solid #d9e2ec;border-radius:12px;padding:12px 10px;text-align:center;background:#fff}' +
            '.stat .k{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#627d98}' +
            '.stat .v{font-size:22px;font-weight:800;color:#1a4b8c;margin-top:4px;line-height:1.1}' +
            '.stat .s{font-size:11px;color:#486581;margin-top:4px}' +
            '.stat.accent{border-color:#c5daf5;background:#eef5fb}' +
            '.stat.accent .v{color:#c41e3a}' +
            '.semester{margin-bottom:18px;break-inside:avoid}' +
            '.semester-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:8px}' +
            '.semester-head h2{margin:0;font-size:15px;color:#1a4b8c}' +
            '.semester-meta{display:flex;flex-wrap:wrap;gap:8px 12px;font-size:11px;color:#486581}' +
            '.semester-meta strong{color:#102a43;font-size:13px}' +
            '.table-wrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}' +
            'table{width:100%;border-collapse:collapse;font-size:12px;min-width:480px}' +
            'th,td{padding:8px 10px;border-bottom:1px solid #e6eef6;text-align:left}' +
            'th{background:#1a4b8c;color:#fff;font-weight:600;font-size:11px;letter-spacing:.03em;text-transform:uppercase}' +
            'tr:nth-child(even) td{background:#f8fafc}' +
            'td.num,th:nth-child(3),th:nth-child(5){text-align:center}' +
            'td.grade{text-align:center;font-weight:700;color:#1a4b8c}' +
            'td.empty,.empty-note{text-align:center;color:#627d98;padding:16px}' +
            '.footnote{margin-top:22px;padding-top:12px;border-top:1px solid #d9e2ec;font-size:10px;color:#627d98}' +
            '.footnote strong{color:#334e68}' +
            '.toolbar{display:flex;justify-content:flex-end;gap:8px;margin:0 0 14px;position:sticky;top:0;z-index:5;background:rgba(244,247,251,.92);backdrop-filter:blur(6px);padding:8px 0}' +
            '.toolbar button{appearance:none;border:1px solid #1a4b8c;background:#1a4b8c;color:#fff;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:700;cursor:pointer}' +
            '.toolbar button.secondary{background:#fff;color:#1a4b8c}' +
            '@media (max-width:720px){' +
              'body{background:#fff}' +
              '.sheet{padding:12px 12px 24px}' +
              '.brand{flex-direction:column;align-items:flex-start;gap:10px}' +
              '.doc-title{text-align:left}' +
              '.doc-title h1{font-size:16px}' +
              '.brand-m{font-size:36px}' +
              '.brand-ub{font-size:14px}' +
              '.brand-cap{top:-12px;width:36px;height:25px}' +
              '.brand-cap svg{width:36px;height:25px}' +
              '.student{grid-template-columns:1fr;gap:12px}' +
              '.stats{grid-template-columns:repeat(2,minmax(0,1fr))}' +
              '.stat .v{font-size:20px}' +
              '.semester-head{align-items:flex-start}' +
              'table{font-size:11px;min-width:420px}' +
              'th,td{padding:7px 8px}' +
            '}' +
            '@media (max-width:420px){' +
              '.stats{grid-template-columns:1fr 1fr}' +
              '.stat{padding:10px 8px}' +
              '.stat .k{font-size:9px}' +
              '.stat .v{font-size:18px}' +
            '}' +
            '@media print{' +
              'body{background:#fff}' +
              '.toolbar{display:none!important}' +
              '.sheet{padding:0;max-width:none}' +
              'body{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
              '.stat,.student,th{print-color-adjust:exact}' +
              'table{min-width:0}' +
            '}' +
            '</style></head><body><div class="sheet">' +
            '<div class="toolbar"><button type="button" class="secondary" onclick="window.close()">Close</button><button type="button" onclick="window.print()">Save / Print PDF</button></div>' +
            '<header class="brand">' +
                '<div>' + logoMarkup() +
                '<div class="brand-sub">University of Botswana · Student Academic Summary</div></div>' +
                '<div class="doc-title"><h1>GPA Transcript Summary</h1><p>Generated ' + escapeHtml(generated) + '</p></div>' +
            '</header>' +
            '<section class="student">' +
                '<div><span class="label">Student</span><span class="value">' + escapeHtml(name) + '</span></div>' +
                '<div><span class="label">Student ID</span><span class="value">' + escapeHtml(studentId || '—') + '</span></div>' +
                '<div><span class="label">Program</span><span class="value">' + escapeHtml(program || programType || '—') + (yearOfStudy ? ' · ' + escapeHtml(yearOfStudy) : '') + '</span></div>' +
                '<div><span class="label">Classification</span><span class="value">' + escapeHtml(cls.name || 'N/A') + '</span></div>' +
                (email ? '<div><span class="label">Email</span><span class="value">' + escapeHtml(email) + '</span></div>' : '') +
            '</section>' +
            '<section class="stats">' +
                '<div class="stat accent"><div class="k">Cumulative GPA</div><div class="v">' + MyUBGPA.formatGPA(gpa) + '</div><div class="s">out of 5.00</div></div>' +
                '<div class="stat"><div class="k">Courses taken</div><div class="v">' + totalCourses + '</div><div class="s">with recorded grades</div></div>' +
                '<div class="stat"><div class="k">Credits earned</div><div class="v">' + earned + '</div><div class="s">toward degree' + (required ? ' / ' + required : '') + '</div></div>' +
                '<div class="stat"><div class="k">Credits attempted</div><div class="v">' + attempted + '</div><div class="s">graded credit load</div></div>' +
            '</section>' +
            semesterBlocks +
            '<footer class="footnote">' +
                '<strong>Unofficial MyUB summary.</strong> This document is generated from your MyUB course records for personal tracking. ' +
                'It is not an official University of Botswana transcript — verify all results with the Registrar.' +
                '<br>© MyUB · Built by Futurify Designs' +
            '</footer>' +
            '</div></body></html>';

        var w = window.open('', '_blank');
        if (!w) {
            alert('Please allow pop-ups to export PDF.');
            return;
        }
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.focus();
    }

    function alertSent(key) {
        var sent = lsGet(ALERT_KEY, {});
        return sent[key];
    }

    function markAlertSent(key) {
        var sent = lsGet(ALERT_KEY, {});
        sent[key] = Date.now();
        lsSet(ALERT_KEY, sent);
    }

    function shouldNotifyAgain(key, hours) {
        var ts = alertSent(key);
        if (!ts) return true;
        return (Date.now() - ts) > (hours || 24) * 3600000;
    }

    async function createNotification(supabase, userId, title, message, link) {
        if (!supabase || !userId) return;
        try {
            await supabase.from('notifications').insert({
                user_id: userId,
                title: title,
                message: message,
                link: link || null,
                is_read: false
            });
        } catch (e) { /* table may differ */ }
    }

    async function checkExamAlerts(supabase, userId) {
        if (!supabase || !userId) return;
        try {
            var now = new Date();
            var in48h = new Date(now.getTime() + 48 * 3600000);
            var res = await supabase
                .from('schedules')
                .select('id,title,start_time,course_code')
                .eq('user_id', userId)
                .eq('event_type', 'exam')
                .gte('start_time', now.toISOString())
                .lte('start_time', in48h.toISOString())
                .order('start_time', { ascending: true });

            if (res.error || !res.data) return;

            for (var i = 0; i < res.data.length; i++) {
                var ex = res.data[i];
                var key = 'exam_' + ex.id;
                if (!shouldNotifyAgain(key, 24)) continue;
                var when = new Date(ex.start_time);
                var hrs = Math.round((when - now) / 3600000);
                await createNotification(
                    supabase, userId,
                    'Exam coming up',
                    (ex.course_code ? ex.course_code + ': ' : '') + ex.title + ' in ~' + hrs + 'h',
                    'schedule.html'
                );
                markAlertSent(key);
            }
        } catch (e) { /* ignore */ }
    }

    async function checkGpaGoalAlert(supabase, userId, gpa, goal) {
        if (!goal || !goal.target || !userId) return;
        var key = 'gpa_goal_' + userId;
        if (!shouldNotifyAgain(key, 24)) return;

        var prog = goalProgress(gpa, goal);
        if (prog.met) {
            await createNotification(supabase, userId, 'GPA goal reached!',
                'Your GPA (' + MyUBGPA.formatGPA(gpa) + ') meets your goal of ' + goal.target.toFixed(2) + '.',
                'gpa-calculator.html');
            markAlertSent(key);
        } else if (prog.gap <= 0.15 && prog.gap > 0) {
            await createNotification(supabase, userId, 'Almost at your GPA goal',
                'Only ' + prog.gap.toFixed(2) + ' points to reach ' + goal.target.toFixed(2) + '.',
                'gpa-calculator.html');
            markAlertSent(key);
        }
    }

    async function runAcademicAlerts(supabase, userId, gpa) {
        var goal = await loadGoal(supabase, userId);
        await checkExamAlerts(supabase, userId);
        if (gpa != null && goal) await checkGpaGoalAlert(supabase, userId, gpa, goal);
        return goal;
    }

    function formatExamCountdown(startIso) {
        if (!startIso) return null;
        var start = new Date(startIso);
        var now = new Date();
        var diff = start - now;
        if (diff < 0) return null;
        var days = Math.floor(diff / 86400000);
        var hrs = Math.floor((diff % 86400000) / 3600000);
        if (days > 0) return days + 'd ' + hrs + 'h';
        var mins = Math.floor((diff % 3600000) / 60000);
        return hrs + 'h ' + mins + 'm';
    }

    async function addCourseFromSchedule(supabase, userId, event, semesterKey) {
        if (!supabase || !userId || !event) return { ok: false, error: 'Missing data' };
        var code = (event.course_code || '').trim();
        if (!code) {
            var m = (event.title || '').match(/^([A-Z]{2,4}\s?\d{3,4})/i);
            code = m ? m[1].toUpperCase() : '';
        }
        if (!code) return { ok: false, error: 'No course code on this event' };

        var parts = (semesterKey || MyUBGPA.inferCurrentSemesterKey()).split(' - ');
        var row = {
            user_id: userId,
            course_code: code.replace(/\s+/g, ' ').trim(),
            course_name: event.title || code,
            credits: 3,
            academic_year: parts[0] || 'Year 1',
            semester: parts[1] || 'Semester 1',
            final_score: null,
            grade: null,
            grade_points: null
        };

        var existing = await supabase.from('courses').select('id').eq('user_id', userId).eq('course_code', row.course_code).maybeSingle();
        if (existing.data) return { ok: false, error: 'Course already in GPA tracker', existing: true };

        var ins = await supabase.from('courses').insert(row);
        if (ins.error) return { ok: false, error: ins.error.message };
        return { ok: true, course: row };
    }

    global.MyUBAcademic = {
        getGoal: getGoal,
        setGoalLocal: setGoalLocal,
        loadGoal: loadGoal,
        saveGoal: saveGoal,
        getCourseCA: getCourseCA,
        setCourseCA: setCourseCA,
        getAllCA: getAllCA,
        mergeCourseCA: mergeCourseCA,
        goalProgress: goalProgress,
        whatIfGPA: whatIfGPA,
        renderWhatIfPanel: renderWhatIfPanel,
        exportTranscriptPDF: exportTranscriptPDF,
        runAcademicAlerts: runAcademicAlerts,
        formatExamCountdown: formatExamCountdown,
        addCourseFromSchedule: addCourseFromSchedule
    };
})(typeof window !== 'undefined' ? window : this);
