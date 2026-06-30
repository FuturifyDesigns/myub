/**
 * MyUB GPA — shared University of Botswana grading logic
 */
(function (global) {
    'use strict';

    var GRADING_SCALE = {
        'A':  { min: 80, max: 100, points: 5.0, description: 'Outstanding' },
        'B+': { min: 75, max: 79.9, points: 4.5, description: 'Excellent' },
        'B':  { min: 70, max: 74.9, points: 4.0, description: 'Very Good' },
        'B-': { min: 65, max: 69.9, points: 3.5, description: 'Good' },
        'C+': { min: 60, max: 64.9, points: 3.0, description: 'Satisfactory' },
        'C':  { min: 55, max: 59.9, points: 2.5, description: 'Pass' },
        'C-': { min: 50, max: 54.9, points: 2.0, description: 'Marginal Pass' },
        'D+': { min: 45, max: 49.9, points: 1.5, description: 'Marginal' },
        'D':  { min: 40, max: 44.9, points: 1.0, description: 'Marginal Fail' },
        'D-': { min: 35, max: 39.9, points: 0.5, description: 'Fail' },
        'E':  { min: 0, max: 34.9, points: 0.0, description: 'Fail' }
    };

    var CLASSIFICATIONS = [
        { min: 4.4, max: 5.0, name: 'First Class / Distinction', badge: 'first' },
        { min: 3.6, max: 4.39, name: 'Second Class Upper / Merit', badge: 'upper' },
        { min: 2.8, max: 3.59, name: 'Second Class Lower / Credit', badge: 'lower' },
        { min: 2.0, max: 2.79, name: 'Pass', badge: 'pass' },
        { min: 0, max: 1.99, name: 'Fail', badge: 'fail' }
    ];

    var CREDIT_REQUIREMENTS = {
        certificate: 30,
        diploma: 60,
        graduate: 48,
        bachelor: 120
    };

    var PROGRAM_LABELS = {
        certificate: 'Certificate',
        diploma: 'Diploma',
        graduate: 'Graduate',
        bachelor: "Bachelor's Degree"
    };

    /* Grades that do not count toward earned degree credits */
    var FAIL_GRADES_EARNED = ['D+', 'D', 'D-', 'E'];

    function getGradeFromScore(score) {
        if (score === null || score === undefined || score === '') return null;
        score = Math.round(parseFloat(score) * 10) / 10;
        if (isNaN(score)) return null;
        var grades = Object.keys(GRADING_SCALE);
        for (var i = 0; i < grades.length; i++) {
            var g = grades[i];
            var r = GRADING_SCALE[g];
            if (score >= r.min && score <= r.max) return g;
        }
        return 'E';
    }

    function getGradePoints(grade) {
        return GRADING_SCALE[grade] ? GRADING_SCALE[grade].points : 0;
    }

    function getClassification(gpa) {
        if (!gpa || gpa === 0) return { name: 'N/A', badge: 'none' };
        for (var i = 0; i < CLASSIFICATIONS.length; i++) {
            var c = CLASSIFICATIONS[i];
            if (gpa >= c.min && gpa <= c.max) return c;
        }
        return { name: 'N/A', badge: 'none' };
    }

    function getGPAStatus(gpa) {
        if (!gpa || gpa === 0) return 'Add courses to calculate';
        var c = getClassification(gpa);
        if (c.badge === 'first') return c.name + ' 🎉';
        return c.name;
    }

    function calculateGPA(coursesList) {
        if (!coursesList || !coursesList.length) return 0;
        var totalPoints = 0;
        var totalCredits = 0;
        coursesList.forEach(function (course) {
            if (course.grade && course.credits) {
                totalPoints += getGradePoints(course.grade) * course.credits;
                totalCredits += course.credits;
            }
        });
        return totalCredits > 0 ? totalPoints / totalCredits : 0;
    }

    function earnedCredits(coursesList) {
        if (!coursesList) return 0;
        return coursesList.reduce(function (sum, c) {
            if (c.grade && FAIL_GRADES_EARNED.indexOf(c.grade) === -1) {
                return sum + (c.credits || 0);
            }
            return sum;
        }, 0);
    }

    function totalCourseCredits(coursesList) {
        if (!coursesList) return 0;
        return coursesList.reduce(function (sum, c) { return sum + (c.credits || 0); }, 0);
    }

    function semesterKey(course) {
        return (course.academic_year || '') + ' - ' + (course.semester || '');
    }

    function inferCurrentSemesterKey(yearOfStudy) {
        var month = new Date().getMonth() + 1;
        var sem = (month >= 1 && month <= 6) ? 'Semester 1' : 'Semester 2';
        var year = yearOfStudy ? ('Year ' + yearOfStudy) : 'Year 1';
        return year + ' - ' + sem;
    }

    function coursesInSemester(coursesList, key) {
        if (!key) return coursesList || [];
        return (coursesList || []).filter(function (c) {
            return semesterKey(c) === key;
        });
    }

    function groupBySemester(coursesList) {
        var map = {};
        (coursesList || []).forEach(function (c) {
            var k = semesterKey(c);
            if (!map[k]) map[k] = [];
            map[k].push(c);
        });
        return map;
    }

    function formatGPA(gpa, decimals) {
        decimals = decimals === undefined ? 1 : decimals;
        return (gpa || 0).toFixed(decimals);
    }

    function gpaToPercent(gpa) {
        return Math.min(100, Math.max(0, (gpa / 5) * 100));
    }

    function requiredCreditsForProgram(programType) {
        return CREDIT_REQUIREMENTS[programType] || CREDIT_REQUIREMENTS.bachelor;
    }

    function projectedFinalScore(caMark, examMark, caWeight, examWeight) {
        caWeight = caWeight || 40;
        examWeight = examWeight || 60;
        return (parseFloat(caMark) || 0) * (caWeight / 100) +
               (parseFloat(examMark) || 0) * (examWeight / 100);
    }

    function gradeBadgeClass(grade) {
        if (!grade) return '';
        var g = String(grade);
        if (g.endsWith('+')) return g.slice(0, -1) + '-plus';
        if (g.endsWith('-')) return g.slice(0, -1) + '-minus';
        return g;
    }

    global.MyUBGPA = {
        GRADING_SCALE: GRADING_SCALE,
        CLASSIFICATIONS: CLASSIFICATIONS,
        CREDIT_REQUIREMENTS: CREDIT_REQUIREMENTS,
        PROGRAM_LABELS: PROGRAM_LABELS,
        FAIL_GRADES_EARNED: FAIL_GRADES_EARNED,
        getGradeFromScore: getGradeFromScore,
        getGradePoints: getGradePoints,
        getClassification: getClassification,
        getGPAStatus: getGPAStatus,
        calculateGPA: calculateGPA,
        earnedCredits: earnedCredits,
        totalCourseCredits: totalCourseCredits,
        semesterKey: semesterKey,
        inferCurrentSemesterKey: inferCurrentSemesterKey,
        coursesInSemester: coursesInSemester,
        groupBySemester: groupBySemester,
        formatGPA: formatGPA,
        gpaToPercent: gpaToPercent,
        requiredCreditsForProgram: requiredCreditsForProgram,
        projectedFinalScore: projectedFinalScore,
        gradeBadgeClass: gradeBadgeClass
    };
})(typeof window !== 'undefined' ? window : this);
