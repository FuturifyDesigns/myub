/**
 * MyUB Academic — GPA goals, CA metadata, what-if, export, alerts
 */
(function (global) {
    'use strict';

    var GOAL_KEY = 'myub_gpa_goal';
    var CA_KEY = 'myub_course_ca';
    var ALERT_KEY = 'myub_academic_alerts';

    function lsGet(key, fallback) {
        try {
            var v = localStorage.getItem(key);
            return v ? JSON.parse(v) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function lsSet(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
    }

    function goalStorageKey(userId) {
        return GOAL_KEY + '_' + (userId || 'anon');
    }

    function caStorageKey(userId) {
        return CA_KEY + '_' + (userId || 'anon');
    }

    function getGoal(userId) {
        var g = lsGet(goalStorageKey(userId), null);
        return g && typeof g.target === 'number' ? g : null;
    }

    function setGoalLocal(userId, target) {
        if (target === null || target === '' || target === undefined) {
            try { localStorage.removeItem(goalStorageKey(userId)); } catch (e) { /* ignore */ }
            return true;
        }
        var t = parseFloat(target);
        if (isNaN(t) || t < 0 || t > 5) return false;
        lsSet(goalStorageKey(userId), { target: t, updated: new Date().toISOString() });
        return true;
    }

    async function loadGoal(supabase, userId) {
        var local = getGoal(userId);
        if (!supabase || !userId) return local;
        try {
            var res = await supabase.from('profiles').select('gpa_goal').eq('id', userId).maybeSingle();
            if (!res.error && res.data && res.data.gpa_goal != null) {
                var t = parseFloat(res.data.gpa_goal);
                if (!isNaN(t)) {
                    setGoalLocal(userId, t);
                    return { target: t };
                }
            }
        } catch (e) { /* column may not exist */ }
        return local;
    }

    async function saveGoal(supabase, userId, target) {
        if (!setGoalLocal(userId, target)) return { ok: false, error: 'Goal must be between 0 and 5' };
        if (supabase && userId) {
            try {
                var res = await supabase.from('profiles').update({ gpa_goal: parseFloat(target) }).eq('id', userId);
                if (res.error && /gpa_goal|column/i.test(res.error.message || '')) {
                    return { ok: true, localOnly: true };
                }
                if (res.error) return { ok: false, error: res.error.message };
            } catch (e) {
                return { ok: true, localOnly: true };
            }
        }
        return { ok: true };
    }

    function getAllCA(userId) {
        return lsGet(caStorageKey(userId), {});
    }

    function getCourseCA(userId, courseId) {
        var all = getAllCA(userId);
        return all[courseId] || { ca_weight: 40, exam_weight: 60, ca_mark: null, exam_mark: null };
    }

    function setCourseCA(userId, courseId, data) {
        var all = getAllCA(userId);
        all[courseId] = Object.assign(getCourseCA(userId, courseId), data || {});
        lsSet(caStorageKey(userId), all);
    }

    function mergeCourseCA(courses, userId) {
        var all = getAllCA(userId);
        return (courses || []).map(function (c) {
            var ca = all[c.id] || {};
            var merged = Object.assign({}, c, {
                ca_weight: ca.ca_weight != null ? ca.ca_weight : 40,
                exam_weight: ca.exam_weight != null ? ca.exam_weight : 60,
                ca_mark: ca.ca_mark,
                exam_mark: ca.exam_mark
            });
            if (merged.ca_mark != null && merged.exam_mark != null && !merged.final_score) {
                merged.projected_score = MyUBGPA.projectedFinalScore(
                    merged.ca_mark, merged.exam_mark, merged.ca_weight, merged.exam_weight
                );
            }
            return merged;
        });
    }

    function goalProgress(gpa, goal) {
        if (!goal || !goal.target) return null;
        var target = goal.target;
        var pct = Math.min(100, Math.max(0, (gpa / target) * 100));
        var met = gpa >= target;
        return { target: target, current: gpa, percent: pct, met: met, gap: target - gpa };
    }

    function whatIfGPA(existingCourses, hypotheticalCourses) {
        var combined = (existingCourses || []).concat(hypotheticalCourses || []);
        return MyUBGPA.calculateGPA(combined);
    }

    function renderWhatIfPanel(container, existingCourses, onUpdate) {
        if (!container) return;
        var rows = [];
        var id = 0;
        var removeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>';
        var addIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
        var calcIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>';

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
            var current = MyUBGPA.calculateGPA(existingCourses || []);
            var projected = whatIfGPA(existingCourses, hypo);
            var delta = projected - current;
            container.querySelector('.whatif-current').textContent = MyUBGPA.formatGPA(current);
            container.querySelector('.whatif-projected').textContent = MyUBGPA.formatGPA(projected);
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

        function addRow() {
            var rowId = ++id;
            rows.push({ id: rowId, credits: 3, grade: 'B' });
            var list = container.querySelector('.whatif-rows');
            var div = document.createElement('div');
            div.className = 'whatif-row';
            div.dataset.rowId = rowId;
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

        function gradeOptions(selected) {
            return Object.keys(MyUBGPA.GRADING_SCALE).map(function (g) {
                return '<option value="' + g + '"' + (g === selected ? ' selected' : '') + '>' + g + '</option>';
            }).join('');
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
        sync();
    }

    function exportTranscriptPDF(courses, profile) {
        var name = (profile && (profile.full_name || profile.username)) || 'Student';
        var program = (profile && profile.program_name) || '';
        var gpa = MyUBGPA.calculateGPA(courses);
        var cls = MyUBGPA.getClassification(gpa);

        var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>MyUB GPA Transcript</title>' +
            '<style>body{font-family:Segoe UI,Arial,sans-serif;padding:40px;color:#1a365d}' +
            'h1{color:#c41e3a;margin:0 0 8px}table{width:100%;border-collapse:collapse;margin-top:24px}' +
            'th,td{border:1px solid #ddd;padding:10px;text-align:left;font-size:13px}' +
            'th{background:#1a365d;color:#fff}.summary{margin-top:24px;padding:16px;background:#f8fafc;border-radius:8px}' +
            '</style></head><body>' +
            '<h1>MyUB GPA Summary</h1>' +
            '<p><strong>' + escapeHtml(name) + '</strong>' + (program ? ' — ' + escapeHtml(program) : '') + '</p>' +
            '<p>Generated ' + new Date().toLocaleString() + '</p>' +
            '<div class="summary"><strong>Cumulative GPA:</strong> ' + MyUBGPA.formatGPA(gpa) +
            ' &nbsp;|&nbsp; <strong>Classification:</strong> ' + escapeHtml(cls.name) + '</div>' +
            '<table><thead><tr><th>Code</th><th>Course</th><th>Year</th><th>Sem</th><th>Credits</th><th>Grade</th></tr></thead><tbody>';

        (courses || []).forEach(function (c) {
            html += '<tr><td>' + escapeHtml(c.course_code || '') + '</td><td>' + escapeHtml(c.course_name || '') +
                '</td><td>' + escapeHtml(c.academic_year || '') + '</td><td>' + escapeHtml(c.semester || '') +
                '</td><td>' + (c.credits || '') + '</td><td>' + escapeHtml(c.grade || '—') + '</td></tr>';
        });

        html += '</tbody></table><p style="margin-top:32px;font-size:11px;color:#666">Unofficial summary from MyUB. Verify with the University of Botswana registrar.</p></body></html>';

        var w = window.open('', '_blank');
        if (!w) {
            alert('Please allow pop-ups to export PDF.');
            return;
        }
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(function () { w.print(); }, 400);
    }

    function escapeHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
            await createNotification(supabase, userId, 'GPA goal reached! 🎉',
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
