(function () {
    var UNLABELED_RE = /solutions_unlabeled_\d+\.svg$/;
    var LABELED_RE = /solutions_labeled_\d+\.svg$/;
    var STYLE = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;text-anchor:middle;dominant-baseline:central;fill:#fff;stroke:#222;stroke-width:3px;paint-order:stroke;";

    function textEl(letter, x, y) {
        var t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("data-label", "1");
        t.setAttribute("x", x);
        t.setAttribute("y", y);
        t.setAttribute("style", STYLE);
        t.textContent = letter;
        return t;
    }

    function svgLabeled(svg) {
        var polys = svg.querySelectorAll("polygon[data-piece]");
        if (!polys.length) return false;
        svg.setAttribute("data-labeled", "1");
        var m = parseFloat(svg.getAttribute("data-m"));
        var cell = parseFloat(svg.getAttribute("data-cell"));
        if (isNaN(m)) m = 18;
        if (isNaN(cell)) cell = 22;
        for (var i = 0; i < polys.length; i++) {
            var p = polys[i];
            var lx = parseFloat(p.getAttribute("data-lx"));
            var ly = parseFloat(p.getAttribute("data-ly"));
            if (isNaN(lx) || isNaN(ly)) continue;
            svg.appendChild(textEl(p.getAttribute("data-piece"),
                (m + lx * cell).toFixed(2), (m + ly * cell).toFixed(2)));
        }
        return true;
    }

    function svgUnlabeled(svg) {
        var labels = svg.querySelectorAll("text[data-label]");
        for (var i = labels.length - 1; i >= 0; i--) labels[i].remove();
        svg.removeAttribute("data-labeled");
    }

    function toggleSvg(svg) {
        if (svg.hasAttribute("data-labeled")) svgUnlabeled(svg);
        else svgLabeled(svg);
    }

    function toggleImg(img) {
        var src = img.getAttribute("src") || "";
        if (UNLABELED_RE.test(src)) img.src = src.replace("unlabeled_", "labeled_");
        else if (LABELED_RE.test(src)) img.src = src.replace("labeled_", "unlabeled_");
    }

    document.addEventListener("click", function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var a = e.target.closest("a.sollink, a.th");
        if (a) {
            var img = a.querySelector("img");
            if (img) {
                toggleImg(img);
                e.preventDefault();
                return;
            }
            var svg = a.querySelector("svg[data-board]");
            if (svg) {
                toggleSvg(svg);
                e.preventDefault();
                return;
            }
            return;
        }
        var svg = e.target.closest("svg[data-board]");
        if (svg) toggleSvg(svg);
    });
})();
