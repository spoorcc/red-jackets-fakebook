var songs_folder = 'songs';
var current_song = null;
var paper_chords = null;
var paper_score = null;
var printer = null;

var abcParser = null;

var renderParams = {
    'margin_for_scrollbar': 20,
    'scale': 1,
    'staffwidth': 500,
    'score_height': 400,
    'paddingtop': 15,
    'paddingbottom': 30,
    'paddingleft': 15,
    'paddingright': 15,
    'editable': false,
    'chords': {
        'hor_margin': 50,
        'vert_margin': 10,
        'height': 40,
        'table': {
            'stroke': '#666666',
            'stroke-width': 0.5
        },
        'text': {
            opacity: 100,
            'font-family': 'serif',
            'font-weight': 200,
            'font-size': 20
        }
    }
};

/*
   Function: parse_song_list
   Parses the songlist and adds them to the song_menu

   Parameters:

      data - The list of songs, with on each line a name
             followed by a comma and the path. (No whitespaces around the comma)
*/

function parse_song_list(data) {

    var songs = data.split('\n');
    var number_of_songs = songs.length - 1;

    for (var i = 0; i < number_of_songs; i++) {

        var song_name = songs[i].split(",")[0];
        var song_path = songs_folder + '/' + songs[i].split(",")[1];

        $("#song_menu").append("<li data-path=" + song_path + " data-rel='close'>" + song_name + " </li>");
    }
}

/*
   Function: reset_render_stuff
   Creates two new papers using the current screensize
*/

function reset_render_stuff() {

    var screenWidth = $(window).width() - renderParams.margin_for_scrollbar;
    current_song.formatting.staffwidth = screenWidth - renderParams.paddingleft - renderParams.paddingright;

    if (paper_score !== null) {
        var paper_scoreDom = paper_score.canvas;
        paper_scoreDom.parentNode.removeChild(paper_scoreDom);
    }

    paper_score = Raphael('notation', screenWidth, renderParams.score_height);
    printer = new ABCPrinter(paper_score);
}

/*
   Function: render_chords
   Places the chords on the global paper_chords using the global renderParams

   Parameters:

      chords_to_render - List of lists. A list per measure contaning the Chords
*/

function render_chords(chords_to_render) {

    var cols = 4;
    if (chords_to_render.length > (4 * 4)) {
        cols = 8;
    }

    var rows = Math.ceil(chords_to_render.length / cols);

    var paper_width = $(window).width() - renderParams.margin_for_scrollbar;
    var paper_heigth = rows * renderParams.chords.height + renderParams.paddingtop + renderParams.paddingbottom;

    var width = (paper_width - renderParams.paddingleft - renderParams.paddingright) / cols;

    var x_offset = renderParams.paddingleft;
    var y_offset = renderParams.paddingtop;

    if (paper_chords !== null) {
        var paperDom = paper_chords.canvas;
        paperDom.parentNode.removeChild(paperDom);
    }
    paper_chords = Raphael('chords', paper_width, paper_heigth);

    for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {

            var rect_x = x * width + x_offset;
            var rect_y = y * renderParams.chords.height + y_offset;

            var rect = paper_chords.rect(rect_x, rect_y, width, renderParams.chords.height);
            rect.attr(renderParams.chords.table);

            var chord_idx = x + y * cols;

            if (chord_idx < chords_to_render.length) {
                var chords = chords_to_render[chord_idx];
                chords = chords.join("  - ");

                var text = paper_chords.text(rect_x + width / 2, rect_y + renderParams.chords.height / 2, chords);
                text.attr(renderParams.chords.text).toFront();
            }
        }
    }
}

/*
   Function: render_song
   Lets the abc library render the song_to_render on the global paper_score

   Parameters:

      song_to_render - A song in the abcjs intermediate format
*/

function render_song(song_to_render) {

    paper_score.clear();
    printer.printABC(song_to_render);
}

/*
   Funcion: parse_key_signature
   Returns a string name of the key parsed from the passed in key_signature

   Parameters:

       key_signature - A key signature in the abcjs intermediate format

   Returns:
       key - A string representing the key
*/

function parse_key_signature(key_signature) {

    // Todo: seven accidentals case
    var sharps = "CGDAEBF";
    var flats = "CFBEADG";

    var key = 'C';

    if (key_signature.accidentals[0] !== undefined) {
        var number_of_accidentals = key_signature.accidentals.length;
        var acc = key_signature.accidentals[0].acc;

        if (acc === 'sharp') {
            key = sharps.charAt(number_of_accidentals);
        } else {
            key = flats.charAt(number_of_accidentals);

            if (number_of_accidentals > 1) {
                key += 'b';
            }
        }
    }

    key += 'M';

    return key;
}

/*
   Function: teoria_chord_name_to_abc_chord_name
   Teoria chords have slightly different formatting

   Parmeters:

      teoria_chord_name - A string representing a chord following teoria syntax

    Returns:

       abc_chord - renames the string to abc chord syntax
*/

function teoria_chord_name_to_abc_chord_name(teoria_chord_name) {

    return teoria_chord_name.replace("M", "");
}

/*
   Function: update_current_key
   Parses the current key from the current_song and does all update actions
*/

function update_current_key() {

    var key = parse_key_signature(current_song.lines[0].staff[0].key);

    key = teoria_chord_name_to_abc_chord_name(key);

    $('#transpose_menu option[value=' + key + ']').attr('selected', true);
}

/*
   Function: parse_string_to_abc_tune
   Parses a string into the abcjs intermediate format used fir rendering

   Parameters:

      text - A string containing a valid abc file
*/

function parse_string_to_abc_tune(text) {

    console.log("parse_string_to_abc_tune");

    var tunebook = new AbcTuneBook(text);

    abcParser.parse(tunebook.tunes[0].abc); //TODO handle multiple tunes
    current_song = abcParser.getTune();

    redraw_everything();
    update_current_key();

}



/*
    Function: init_parsing_stuff

    Creates the AbcParse object with parser params

    - print:           pay attention to margins and other formatting commands that don't make sense in a web page
    - header_only:     only parse the header
    - stop_on_warning: only parse until the first warning is encountered
*/

function init_parsing_stuff() {

    var parserParams = {
        print: false,
        header_only: false,
        stop_on_warning: false
    };

    abcParser = new AbcParse(parserParams);
}

/*
    Funcion: parse_song
    Retrieves the file from path and parses it

    Parameters:

       path - File path of the song to parse
*/

function parse_song(path) {

    console.log("parse_song " + path + " from " + document.location.pathname);
    $.get(path, parse_string_to_abc_tune, 'text');

}

/*
   Funcion: get_width
   Gets the current screenwidth and keeps in mind the orientation of the screen

   Returns:
       width - Screen width of the device
*/

function get_width() {
    var ori = $(window).orientation;
    var width = (ori === 90 || ori === -90) ? $(window).height() : $(window).width();
    return width;
}


/*
   Funcion: replace_accidental_with_utf8_char
   Replaces the sharp and flat signs with the official unicode chars

   Parameters:

       note - A string containing # or b signs

   Returns:
       note - with the b and # replaced
*/

function replace_accidental_with_utf8_char(note) {

    return note.replace("b", "♭")
        .replace("#", "♯");
}

/*
   Funcion: parse_chord_scheme
   Reads the chords from the current_song abcjs intermediate format into a list per measure with the chords

   Returns:
       chords - A list of lists with the chords per measure
*/

function parse_chord_scheme() {

    var chords = [];
    var current_measure = [];

    var parsed_first_bar = false;
    var parsed_valid_chord = false;
    var did_not_parse_chord_in_this_measure = true;

    for (var i = 0; i < current_song.lines.length; i++) {

        var line = current_song.lines[i].staff[0].voices[0];

        for (var line_idx = 0; line_idx < line.length; line_idx++) {

            var element = line[line_idx];

            if (element.el_type === "bar") {

                if (did_not_parse_chord_in_this_measure && parsed_first_bar) {
                    current_measure.push("%");
                }

                if (current_measure.length > 0) {
                    chords.push(current_measure.slice(0));
                    current_measure = [];
                }

                did_not_parse_chord_in_this_measure = true;
                parsed_first_bar = true;
            }

            if (element.chord !== undefined) {
                var chord = replace_accidental_with_utf8_char(element.chord[0].name);
                current_measure.push(chord);
                did_not_parse_chord_in_this_measure = false;
                parsed_valid_chord = true;
            }
        }
    }

    // Prevent returning only % % % % % ....
    if (!parsed_valid_chord) {
        chords = [];
    }
    return chords;
}

/*
   Funcion: key_signature_from_teoria_key
   Returns all accidentals that come with a key

   Parameters:

       key - A string representing the teoria key
       clef - To place the accidentals on the correct bars the clef is needed

   Returns:

       key_signature - All accidentals on the correct positon for the clef
*/

function key_signature_from_teoria_key(key, clef) {

    parse_header = new AbcParseHeader(undefined, undefined, undefined, undefined);

    var abc_key_name = teoria_chord_name_to_abc_chord_name(key);
    var acc = key_signatures[abc_key_name];

    var key_sig = {
        accidentals: acc
    };
    //Add offset for the clef
    parse_header.addPosToKey(clef, key_sig);

    return key_sig;
}

function add_acc_from_key_signature(abc_note, key) {

    if (key.accidentals === undefined) {
        return;
    }

    var abc_root_note = abc_note.pitches[0];

    for (var i = 0; i < key.accidentals.length; i++) {

        if ((abc_root_note.pitch % 8) === (key.accidentals[i].verticalPos % 8)) {

            switch (abc_root_note.accidental) {

                case "":
                    abc_root_note.accidental = key.accidentals[i].acc;
                    break;
                case key.accidentals[i].acc:
                    abc_root_note.accidental = "dbl" + abc_root_note.accidental;
                    break;
            }
        }
    }

    //console.dir(abc_root_note);
}

function remove_acc_from_key_signature(abc_note, key) {

    if (key.accidentals === undefined) {
        return;
    }

    var abc_root_note = abc_note.pitches[0];

    for (var i = 0; i < key.accidentals.length; i++) {

        if (abc_root_note.pitch % 8 === key.accidentals[i].verticalPos % 8) {

            switch (abc_root_note.accidental) {

                case "":
                    abc_root_note.accidental = "natural";
                    break;
                case key.accidentals[i].acc:
                    abc_root_note.accidental = "";
                    break;
            }
        }
    }
}


/*
   Funcion: transpose_note
   Transposes the note of a song with the interval, taking into account the key signatures before and after

   Parameters:

       abc_note - The note to transpose
       teoria_interval - The interval which is used to transpose the note
       current_key_signature - The key signature before transposing
       transposed_key_signature - The key signature after transposing

   Returns:

       note - Transposed note

    See also:

    <add_acc_from_key_signature> <remove_acc_from_key_signature>
*/

function transpose_note(abc_note, teoria_interval, current_key_signature, transposed_key_signature) {

    // If there is a chord, transpose it
    if (abc_note.chord !== undefined) {
        abc_note.chord[0].name = transpose_chord(abc_note.chord[0].name, teoria_interval);
    }

    // If it is a rest do nothing with note
    if (abc_note.pitches === undefined) {
        return abc_note;
    }

    add_acc_from_key_signature(abc_note, current_key_signature);

    // parse the note
    var teoria_note = abc_note_to_teoria_note(abc_note);

    // transpose
    var intv = teoria_interval.toString();
    var transposed_note = teoria_note.interval(intv);
    var transposed_abc_note = teoria_note_to_abc_note(transposed_note);

    remove_acc_from_key_signature(transposed_abc_note, transposed_key_signature);

    //return it
    abc_note.pitches[0].pitch = transposed_abc_note.pitches[0].pitch;
    abc_note.pitches[0].accidental = transposed_abc_note.pitches[0].accidental;
    abc_note.pitches[0].verticalPos = transposed_abc_note.pitches[0].verticalPos;

    abc_note.averagepitch = transposed_abc_note.pitches[0].pitch;
    abc_note.minpitch = transposed_abc_note.pitches[0].pitch;
    abc_note.maxpitch = transposed_abc_note.pitches[0].pitch;

    return abc_note;
}

function transpose_line(line, teoria_interval, current_key, transposed_key) {

    var transposed_line = [];

    for (var i = 0; i < line.length; i++) {

        var element = line[i];

        switch (element.el_type) {

            case "note":
                transposed_line.push(transpose_note(element, teoria_interval, current_key, transposed_key));
                break;
            default:
                transposed_line.push(element);
                break;
        }
    }

    return transposed_line;
}

function transpose_key(key, clef, teoria_interval) {

    var transposed_key = teoria.chord(key);
    transposed_key.transpose(teoria_interval.toString());

    return key_signature_from_teoria_key(transposed_key.toString(), clef);
}

function transpose_song(key) {

    // Get current key
    var current_key = parse_key_signature(current_song.lines[0].staff[0].key);
    current_key = teoria_chord_name_to_abc_chord_name(current_key);

    console.log("Transpose from " + current_key + " to " + key);

    var interval = teoria.interval.between(teoria.note(current_key), teoria.note(key));

    for (var i = 0; i < current_song.lines.length; i++) {

        var clef = current_song.lines[i].staff[0].clef;
        current_key = parse_key_signature(current_song.lines[i].staff[0].key);

        var current_key_signature = key_signature_from_teoria_key(current_key, clef);

        var transposed_key_signature = transpose_key(current_key, clef, interval);

        var line_of_notes = current_song.lines[i].staff[0].voices[0];

        var transposed_line = transpose_line(line_of_notes, interval, current_key_signature, transposed_key_signature);

        current_song.lines[i].staff[0].voices[0] = transposed_line;
        current_song.lines[i].staff[0].key = transposed_key_signature;
    }

    var chord_scheme = parse_chord_scheme();
    render_chords(chord_scheme);

    update_current_key();

    return false;
}

function transpose_chord(abc_chord, teoria_interval) {

    var chord = teoria.chord(abc_chord);
    chord.transpose(teoria_interval.toString());

    return chord.name;
}



function teoria_note_to_abc_note(teoria_note) {

    var teoria_to_abc_pitches = "cdefgab";

    var pitch = teoria_to_abc_pitches.indexOf(teoria_note.name());

    var center_octave = 2;
    var notes_per_octave = 7;
    pitch += notes_per_octave * (teoria_note.octave() - center_octave);

    var accidental = "";
    switch (teoria_note.accidental()) {
        case "x":
            accidental = "dblsharp";
            break;
        case "#":
            accidental = "sharp";
            break;
        case "b":
            accidental = "flat";
            break;
        case "bb":
            accidental = "dblflat";
            break;
        default:
            accidental = "";
            break;
    }

    return {
        pitches: [{
            "pitch": pitch,
            "verticalPos": pitch,
            "accidental": accidental
        }]
    };
}

function teoria_duration_to_abc_duration(teoria_duration) {

    var abc_duration = 1.0 / teoria_duration.value;

    var dots = teoria_duration.dots;
    var half = abc_duration;

    while (dots > 0) {
        dots -= 1;
        half = half / 2;
        abc_duration += half;
    }

    return abc_duration;
}


function abc_note_to_teoria_note(abc_note) {

    var pitches = {
        0: "C",
        1: "D",
        2: "E",
        3: "F",
        4: "G",
        5: "A",
        6: "B",
        7: "c",
        8: "d",
        9: "e",
        10: "f",
        11: "g",
        12: "a",
        13: "b"
    };

    var abc_root_note = abc_note.pitches[0].pitch;
    var pitch_idx = abc_root_note % 14;

    while (pitch_idx < 0) {
        pitch_idx += 7;
    }

    var string_root_note = pitches[pitch_idx];

    console.log(string_root_note);

    // It could be negative
    /*   if (abc_root_note < 0) {

        var octave = abc_root_note / 7;

        for (var i = 0; i < octave; i++)
            string_root_note += ",";
    }

    if (abc_root_note > 13) {

        var octave = abc_root_note / 7 - 1;

        for (var i = 0; i < octave; i++)
            string_root_note += "'";
    }*/

    string_root_note = add_accidental_to_string(string_root_note, abc_note);


    // Not needed now
    //var teoria_duration = abc_duration_to_teoria_duration(abc_note.abc_duration);

    return new teoria.note(string_root_note, 1.0);
}

function abc_duration_to_teoria_duration(abc_duration) {

    var inv_duration = 1.0 / abc_duration;

    var undotted_power = Math.ceil(Math.log(inv_duration) / Math.log(2));
    var undotted_duration = Math.pow(2, undotted_power);

    var remaining_duration = abc_duration - 1.0 / undotted_duration;

    var dots = 0;
    var half = 1.0 / undotted_duration;

    while (remaining_duration > 0.0) {
        half = half / 2;

        dots += 1;
        remaining_duration -= half;
    }

    return {
        "value": undotted_duration,
        "dots": dots
    };
}
/*
 
 */

function add_accidental_to_string(str_note, abc_note) {

    var accidentals = {
        "sharp": "#",
        "dblsharp": "x",
        "natural": "",
        "flat": "b",
        "dblflat": "bb"
    };

    var teoria_root_note_accidental = "";

    var abc_root_note_accidental = abc_note.pitches[0].accidental;

    if (abc_root_note_accidental) {
        teoria_root_note_accidental = accidentals[abc_root_note_accidental];
    }

    //Insert accidental into string after note name and return
    return str_note.substring(0, 1) + teoria_root_note_accidental + str_note.substring(1, str_note.length);
}

function create_nav_bars() {
    $("#navbar").navbar();
}

function load_songs() {
    $.get('songs/_index_of_songs.txt', parse_song_list, 'text');
}

function subscribe_to_events() {

    // Event handler when different song is selected
    $('#song_menu').on('click', 'li', song_listview_event_handler);
    $('#transpose_menu').on('click', 'li', transpose_listview_event_handler);

    // Event handler window resize event
    $(window).bind('resize', function(e) {
        redraw_everything();
    });
}

function song_listview_event_handler(event) {

    var song_path = this.getAttribute('data-path');

    $.mobile.loading('show', {
        theme: "b",
        text: "Loading " + this.text
    });
    parse_song(song_path);
    $.mobile.loading('hide');
}

function transpose_listview_event_handler(event) {

    var key = this.getAttribute('data-key');
    transpose_and_redraw(key);
}

function transpose_and_redraw(key) {

    $.mobile.changePage($("#main"));

    if (current_song !== null) {
        $.mobile.loading('show', {
            theme: "b",
            text: "Transposing song to " + key
        });
        transpose_song(key);
        redraw_everything();
        $.mobile.loading('hide');
    } else {
        alert("Choose a song first!");
        $("#song_panel").panel("open");
    }
}

function selectCurrentChord(svgShapeId) {

    var partThatWasClicked = document.getElementById(svgShapeId);

    partThatWasClicked.setAttribute('stroke-width', 5);
    partThatWasClicked.setAttribute('stroke', 'black');
}

function scaleElementToPage(element) {

    var el = document.getElementById(element);

    var width = el.getAttribute('width');
    var height = el.getAttribute('height');

    var scale = Math.min($(window).width() / width, $(window).height() / height);
    console.log(scale);

    el.setAttribute('transform', 'scale(' + scale + ')');
}

function redraw_everything() {
    reset_render_stuff();

    if (current_song !== null) {
        render_song(current_song);
        var chord_scheme = parse_chord_scheme();
        render_chords(chord_scheme);
    }
}

function init() {
    create_nav_bars();
    subscribe_to_events();
    load_songs();

    init_parsing_stuff();

    redraw_everything();
}