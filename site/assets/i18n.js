const i18n = {
    "en": {
        "title": "Ostomachion",
        "instr": "The Stomachion is a 14-piece dissection puzzle attributed to Archimedes.\
                Arrange all pieces to fill the square exactly.\
                Drag to move, R to rotate, F to flip.",
        "rotate": "Rotate (R)",
        "flip": "Flip (F)",
        "reset": "Reset",
        "status": function(n) {
            return n + " of 14 pieces in place";
        },
        "solved": "Solved! Well done, Archimedes would be proud.",
        "credit": "The Ostomachion (Archimedes' Stomachion), a dissection puzzle from antiquity."
    },
    "de": {
        "title": "Ostomachion",
        "instr": "Das Stomachion ist ein Puzzlespiel mit 14 Teilen, das Archimedes\
                zugeschrieben wird. Ordne alle Teile so an, dass sie das Quadrat exakt\
                ausfüllen. Ziehen zum Bewegen, R zum Drehen, F zum Spiegeln.",
        "rotate": "Drehen (R)",
        "flip": "Spiegeln (F)",
        "reset": "Zurücksetzen",
        "status": function(n) {
            return n + " von 14 Teilen platziert";
        },
        "solved": "Gelöst! Gut gemacht, Archimedes wäre stolz.",
        "credit": "Das Ostomachion (Stomachion des Archimedes), ein antikes Zerlegungsspiel."
    },
    "gr": {
        "title": "Οστόμαχιον",
        "instr": "Το Οστόμαχιον είναι ένα παζλ με 14 κομμάτια που αποδίδεται στον Αρχιμήδη.\
                Τοποθετήστε όλα τα κομμάτια ώστε να γεμίσουν ακριβώς το τετράγωνο.\
                Σύρετε για μετακίνηση, R για περιστροφή, F για αναστροφή.",
        "rotate": "Περιστροφή (R)",
        "flip": "Αναστροφή (F)",
        "reset": "Επαναφορά",
        "status": function(n) {
            return n + " από 14 κομμάτια τοποθετήθηκαν";
        },
        "solved": "Λύθηκε! Μπράβο, ο Αρχιμήδης θα ήταν περήφανος.",
        "credit": "Το Οστόμαχιον (Στομάχιον του Αρχιμήδη), ένα αρχαίο παζλ διάτμησης."
    },
    "it": {
        "title": "Ostomachion",
        "instr": "Lo stomachion è un puzzle di 14 pezzi attribuito ad Archimede.\
                Disponi tutti i pezzi per riempire esattamente il quadrato.\
                Trascina per spostare, R per ruotare, F per capovolgere.",
        "rotate": "Ruota (R)",
        "flip": "Capovolgi (F)",
        "reset": "Ricomincia",
        "status": function(n) {
            return n + " di 14 pezzi posizionati";
        },
        "solved": "Risolto! Ben fatto, Archimede sarebbe orgoglioso.",
        "credit": "L'ostomachion (stomachion di Archimede), un antico puzzle di dissezione."
    },
    "es": {
        "title": "Ostomachion",
        "instr": "El stomachion es un rompecabezas de 14 piezas atribuido a Arquímedes.\
                Coloca todas las piezas para llenar exactamente el cuadrado.\
                Arrastra para mover, R para rotar, F para voltear.",
        "rotate": "Rotar (R)",
        "flip": "Voltear (F)",
        "reset": "Reiniciar",
        "status": function(n) {
            return n + " de 14 piezas colocadas";
        },
        "solved": "¡Resuelto! Bien hecho, Arquímedes estaría orgulloso.",
        "credit": "El ostomachion (stomachion de Arquímedes), un antiguo rompecabezas de disección."
    },
    "fr": {
        "title": "Ostomachion",
        "instr": "Le stomachion est un puzzle de 14 pièces attribué à Archimède.\
                Disposez toutes les pièces pour remplir exactement le carré.\
                Glissez pour déplacer, R pour pivoter, F pour retourner.",
        "rotate": "Pivoter (R)",
        "flip": "Retourner (F)",
        "reset": "Réinitialiser",
        "status": function(n) {
            return n + " pièces sur 14 placées";
        },
        "solved": "Résolu ! Bien joué, Archimède serait fier.",
        "credit": "L'ostomachion (stomachion d'Archimède), un ancien puzzle de dissection."
    }
};

var cur_lang = "en";

function translate(lang) {
    cur_lang = lang;
    var map = i18n[cur_lang];
    $("[data-i18nkey]").map(function() {
        this.innerHTML = map[this.getAttribute("data-i18nkey")];
    });
    try {
        window.localStorage.setItem('lang', lang);
    } catch (err) {
    }
    if (typeof update_status === "function")
        update_status();
}

function i18n_load() {
    var lang;
    try {
        lang = window.localStorage.getItem('lang');
        if (!i18n[lang])
            lang = "en";
    } catch (err) {
        lang = "en";
    }
    translate(lang);
}
