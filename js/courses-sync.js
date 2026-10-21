/**
 * EduCadTech Public Courses Synchronization
 * Dynamically synchronizes course cards on courses.html with SQLite database
 * Ensures all courses added or edited via admin panel appear immediately.
 */

async function syncPublicCourses() {
    try {
        var res = await fetch('/api/courses');
        if (!res.ok) return;
        var data = await res.json();
        if (!data || !data.success || !Array.isArray(data.courses) || data.courses.length === 0) return;

        var grid = document.querySelector('.row.grid');
        if (!grid) return;

        var branchClassMap = {
            'MECH': 'filter1',
            'MECHANICAL': 'filter1',
            'CIVIL': 'filter2',
            'ECE': 'filter3',
            'EEE': 'filter4',
            'CSE': 'filter5',
            'IT': 'filter6'
        };

        var escapeHtml = function (str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        };

        var cardsHtml = data.courses.map(function (c) {
            var branchKey = (c.branch || 'MECH').toUpperCase();
            var branchClass = branchClassMap[branchKey] || 'filter1';
            var isSoft = (c.category || '').toLowerCase().indexOf('soft') !== -1;
            var typeClass = isSoft ? 'softskill' : 'technical';
            var durationText = (c.duration_months || 3) + ' Months';
            var modeText = c.course_type === 'offline' ? 'Offline' : (c.course_type === 'online' ? 'Online' : 'Online / Offline');
            var imgSrc = c.image || 'assets/images/courses/1. mechanical draftman.jpg';

            return '<div class="col-lg-4 col-md-6 grid-item ' + branchClass + ' ' + typeClass + '">' +
                '<div class="courses-item mb-30">' +
                    '<div class="img-part">' +
                        '<a href="course-content.html?id=' + c.id + '">' +
                            '<img alt="' + escapeHtml(c.title) + '" src="' + imgSrc + '" onerror="this.src=\'assets/images/courses/1. mechanical draftman.jpg\'" />' +
                        '</a>' +
                    '</div>' +
                    '<div class="content-part">' +
                        '<ul class="meta-part" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">' +
                            '<li><a class="categorie">' + escapeHtml(c.category || 'Technical Course') + '</a></li>' +
                            '<li><span class="mode-badge-dual"><i class="fa fa-globe"></i> ' + modeText + '</span></li>' +
                        '</ul>' +
                        '<h3 class="title"><a href="course-content.html?id=' + c.id + '">' + escapeHtml(c.title) + '</a></h3>' +
                        '<div class="bottom-part" style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 12px; border-top: 1px solid #f1f5f9;">' +
                            '<div class="course-duration-info" style="color: #64748b; font-size: 13px; font-weight: 500;">' +
                                '<i class="fa fa-clock-o" style="color: #ac192b; margin-right: 4px;"></i> ' + durationText +
                            '</div>' +
                            '<div class="btn-part">' +
                                '<a href="course-content.html?id=' + c.id + '" class="btn-course-content"><i class="fa fa-book"></i> Course Content</a>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');

        grid.innerHTML = cardsHtml;

        // Re-layout isotope grid
        if (typeof jQuery !== 'undefined') {
            var $grid = jQuery('.grid');
            if ($grid.length && typeof $grid.isotope === 'function') {
                if (typeof $grid.imagesLoaded === 'function') {
                    $grid.imagesLoaded(function () {
                        $grid.isotope('reloadItems').isotope({ sortBy: 'original-order' });
                        applyUrlCategoryFilter();
                    });
                } else {
                    $grid.isotope('reloadItems').isotope({ sortBy: 'original-order' });
                    applyUrlCategoryFilter();
                }
            }
        }
    } catch (err) {
        console.warn('Dynamic courses sync fallback:', err);
    }
}

function applyUrlCategoryFilter() {
    var params = new URLSearchParams(window.location.search);
    var cat = params.get('category');
    if (cat) {
        var catMap = {
            'mech': '.filter1',
            'mechanical': '.filter1',
            'civil': '.filter2',
            'civil-engineering': '.filter2',
            'ece': '.filter3',
            'eee': '.filter4',
            'cse': '.filter5',
            'cs': '.filter5',
            'computer-science': '.filter5',
            'it': '.filter6'
        };
        var sel = catMap[cat.toLowerCase()];
        if (sel && typeof jQuery !== 'undefined') {
            var targetBtn = jQuery('#branchFilter button[data-filter="' + sel + '"]');
            if (targetBtn.length) {
                targetBtn.trigger('click');
            }
        }
    }
}

window.addEventListener('DOMContentLoaded', function () {
    syncPublicCourses();
});
