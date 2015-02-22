/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/


/** @file Contains code to load in the other script files, and initialise the exam.
 *
 * Creates the global {@link Numbas} object, inside which everything else is stored, so as not to conflict with anything else that might be running in the page.
 */

(function() {

if(!window.Numbas) { window.Numbas = {} }
/** @namespace Numbas */

/** Extensions should add objects to this so they can be accessed */
Numbas.extensions = {};

/** A function for displaying debug info in the console. It will try to give a reference back to the line that called it, if it can. 
 * @param {string} msg - text to display
 * @param {boolean} [noStack=false] - don't show the stack trace
 */
Numbas.debug = function(msg,noStack)
{
	if(window.console)
	{
		var e = new Error(msg);
		if(e.stack && !noStack)
		{
			var words= e.stack.split('\n')[2];
			console.log(msg," "+words);
		}
		else
		{
			console.log(msg);
		}
	}
};

/** Display an error in a nice alert box. Also sends the error to the console via {@link Numbas.debug} 
 * @param {error} e
 */
Numbas.showError = function(e)
{
	var message = (e || e.message)+'';
	message += ' <br> ' + e.stack.replace(/\n/g,'<br>\n');
	Numbas.debug(message);
	Numbas.display.showAlert(message);
	throw(e);
};

/** Generic error class. Extends JavaScript's Error
 * @constructor
 * @param {string} message - A description of the error. Localised by R.js.
 */
Numbas.Error = function(message)
{
	Error.call(this);
	if(Error.captureStackTrace) {
		Error.captureStackTrace(this, this.constructor);
	}

	this.name="Numbas Error";
	this.originalMessage = message;
	this.message = R.apply(this,arguments);
}
Numbas.Error.prototype = Error.prototype;
Numbas.Error.prototype.constructor = Numbas.Error;

var scriptreqs = {};

/** Keep track of loading status of a script and its dependencies
 * @param {string} file - name of script
 * @global
 * @constructor
 * @property {string} file - Name of script
 * @property {boolean} loaded - Has the script been loaded yet?
 * @property {boolean} executed - Has the script been run?
 * @property {Array.string} backdeps - Scripts which depend on this one (need this one to run first)
 * @property {Array.string} fdeps - Scripts which this one depends on (it must run after them)
 * @property {function} callback - The function to run when all this script's dependencies have run (this is the script itself)
 */
function RequireScript(file)
{
	this.file = file;
	scriptreqs[file] = this;
	this.backdeps = [];
	this.fdeps = [];
}
RequireScript.prototype = {
	loaded: false,
	executed: false,
	backdeps: [],
	fdeps: [],
	callback: null
};


/** Ask to load a javascript file. Unless `noreq` is set, the file's code must be wrapped in a call to Numbas.queueScript with its filename as the first parameter.
 * @memberof Numbas
 * @param {string} file
 * @param {boolean} noreq - don't create a {@link Numbas.RequireScript} object
 */
var loadScript = Numbas.loadScript = function(file,noreq)	
{
	if(!noreq)
	{
		if(scriptreqs[file]!==undefined)
			return;
		var req = new RequireScript(file);
	}
}

/**
 * Queue up a file's code to be executed.
 * Each script should be wrapped in this function
 * @param {string} file - Name of the script
 * @param {Array.string} deps - A list of other scripts which need to be run before this one can be run
 * @param {function} callback - A function wrapping up this file's code
 */
Numbas.queueScript = function(file, deps, callback)	
{
	// find a RequireScript
	var req = scriptreqs[file] || new RequireScript(file);

	if(typeof(deps)=='string')
		deps = [deps];
	for(var i=0;i<deps.length;i++)
	{
		var dep = deps[i];
		deps[i] = dep;
		loadScript(dep);
		scriptreqs[dep].backdeps.push(file);
	}
	req.fdeps = deps;
	req.callback = callback;
	
	req.loaded = true;

	Numbas.tryInit();
}

/** Called when all files have been requested, will try to execute all queued code if all script files have been loaded. */
Numbas.tryInit = function()
{
	if(Numbas.dead) {
		return;
	}

	//put all scripts in a list and go through evaluating the ones that can be evaluated, until everything has been evaluated
	var stack = [];
	var ind = 0;
	function get_ind() {
		return 'margin-left: '+ind+'em';
	}

	function tryRun(req) {
		if(req.loaded && !req.executed) {
			var go = true;
			for(var j=0;j<req.fdeps.length;j++)
			{
				if(!scriptreqs[req.fdeps[j]].executed) {
					go=false;
					break;
				}
			}
			if(go)
			{
				req.callback({exports:window});
				req.executed=true;
				ind++;
				for(var j=0;j<req.backdeps.length;j++) {
					tryRun(scriptreqs[req.backdeps[j]]);
				}
				ind--;
			}
		}
	}
	for(var x in scriptreqs)
	{
		try {
			tryRun(scriptreqs[x]);
		} catch(e) {
			alert(e+'');
			Numbas.debug(e.stack);
			Numbas.dead = true;
			return;
		}
	}
}

/** A wrapper round {@link Numbas.queueScript} to register extensions easily. 
 * @param {string} name - unique name of the extension
 * @param {Array.string} deps - A list of other scripts which need to be run before this one can be run
 * @param {function} callback - Code to set up the extension. It's given the object `Numbas.extensions.<name>` as a parameter, which contains a {@link Numbas.jme.Scope} object.
 */
Numbas.addExtension = function(name,deps,callback) {
	deps.push('jme');
    Numbas.queueScript('extensions/'+name+'/'+name+'.js',deps,function() {
        var extension = Numbas.extensions[name] = {
            scope: new Numbas.jme.Scope()
        };
        callback(extension);
    });
}

})();

Numbas.queueScript('nb-NO',['R'],function() {
/*
   Copyright 2011-14 Newcastle University & 2013 Tore Gaupseth

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

R.registerLocale('nb-NO',{
	'page.loading': "Laster...",
	"page.saving": "<p>Lagrer.</p> <p>Dette kan ta noen sekunder.</p>",

	"die.numbas failed": "Numbas har feilet",
	"die.sorry": "Beklager, det har oppstått en feil, og Numbas kan ikke fortsette. Nedenfor er en beskrivelse av feilen.",
	"die.error": "Feil",

	"question.score feedback.unanswered": "Ikke besvart.",
	"question.score feedback.correct": "Svaret ditt er riktig",
	"question.score feedback.partial": "Svaret ditt er delvis riktig",
	"question.score feedback.wrong": "Svaret ditt er ikke riktig",
	"question.show steps penalty": "Du vil miste <strong>%s</strong> %s.",
	"question.show steps no penalty": "Din score blir ikke påvirket.",
	"question.show steps already penalised": "Du har allerede sett trinnvis gjennomgang. Du kan vise det igjen uten å bli straffet.",
	"question.hide steps": "Skjul trinn",
	"question.hide steps no penalty": "Din score vil bli påvirket.",
	"question.unsubmitted changes.several parts": "Du har endret dine svar uten å lagre dem. Vennligst se igjennom svarene og klikk på <strong>Lagre alle deler</strong> knapp.",
	"question.unsubmitted changes.one part": "Du har endret ditt svar uten å lagre det. Vennligst se igjennom svaret og klikk på <strong>Lagre svar</strong> knapp.",
	"question.selector.unsubmitted changes": "Ikke lagrede svar.",

	'exam.exam name': "Eksamen navn:",
	'exam.number of questions': "Antall spørsmål:",
	'exam.marks available': "Mulige poeng:",
	'exam.pass percentage': "Grense for bestått:",
	'exam.time allowed': "Tillatt tid:",
	'frontpage.start': "Start",
	"exam.random seed": "Sesjon ID:",
	"exam.passed": "Bestått",
	"exam.failed": "Ikke bestått",
	"exam.review header": "Gjennomgang: ",

	'suspend.exam suspended': "Eksamen er avbrutt. Klikk Fortsett for å gå videre.",
	'suspend.you can resume': "Du kan fortsette eksamen neste gang du starter denne aktiviteten.",
	'suspend.resume': "Fortsett",

	'result.review': "Se igjennom",
	'result.exam summary': "Eksamen oversikt",
	'result.exam start': "Eksamen start:",
	'result.exam stop': "Eksamen slutt:",
	'result.time spent': "Tidsbruk:",
	'result.questions attempted': "Antall besvarte spørsmål:",
	'result.score': "Poengsum:",
	'result.result': "Resultat:",
	'result.detailed question breakdown': "Detaljert eksamensresultat",
	'result.question number': "Spørsmål nummer",
	'result.question score': "Poengsum",
	"result.exit": "Avslutt eksamen",
	"result.print": "Skriv ut dette sammendraget",
	"result.performance summary": "Resultatsammendrag",
	"result.question review title": "Gå igjennom dette spørsmålet",
	"result.detailed question breakdown": "Detaljert gjennomgang av spørsmål og tilbakemelding",
	"result.click a question to review": "Klikk på et spørsmålnummer for å se karaktersetting, og om mulig, fullstendig løsning.",

	'end.exam has finished': "Eksamen er avsluttet. Du kan nå lukke vinduet.",

	'control.confirm leave': "Du har ikke levert besvarelse.",
	'control.not all questions answered': "Du har ikke svart på alle spørsmålene i denne eksamen.",
	'control.confirm end': "Er du sikker på at du vil avslutte? Etter dette vil du ikke kunne endre på svarene dine..",
	'control.confirm regen': "Vil du lage nye tilfeldige tall i denne oppgaven? Hvis du klikker OK vil svarene og oppnådde poeng bli annullert.",
	'control.regen': "Prøv et lignende spørsmål",
	'control.submit answer': "Send inn svar",
	'control.submit all parts': "Send inn alle delsvar",
	'control.submit again': "Send inn på nytt",
	'control.submit': "Send inn",
	'control.previous': "Forrige",
	'control.next': "Neste",
	'control.advice': "Svarforslag",
	'control.reveal': "Vis svar",
	'control.total': "Totalt",
	'control.pause': "Pause",
	'control.end exam': "Avslutt eksamen",
	"control.back to results": "Go back to results",
	"control.not all questions submitted": "Du har endret ett eller flere svar men ikke lagret dem. Vennligst se om svarene er lagret.",
	"control.proceed anyway": "Fortsett likevel?",
	"control.confirm reveal": "Vil du se svaret på dette spørsmålet? Alle poeng du har fått hittil vil bli låst - og du kan ikke besvare dette spørsmålet senere.",

	'display.part.jme.error making maths': "Feil i visning av formel",
	
	'exam.xml.bad root': "Elementet på øverste nivå må være 'exam'",
	'exam.changeQuestion.no questions': "Eksamen inneholder ingen spørsmål! Sjekk .exam-fila for feil.",

	'feedback.marks': "<strong>%s</strong> %s",
	'feedback.you were awarded': "Du oppnådde %s.",
	'feedback.taken away': "%s %s er trukket fra.",

	'jme.tokenise.invalid': "Ugyldig uttrykk: %s",

	'jme.shunt.not enough arguments': "Det mangler argumenter for å utføre %s",
	'jme.shunt.no left bracket in function': "Venstre parentes mangler i funksjon eller tuppel",
	'jme.shunt.no left square bracket': "Venstre parentes mangler",
	'jme.shunt.no left bracket': "Venstre parentes mangler",
	'jme.shunt.no right bracket': "Høyre parentes mangler",
	'jme.shunt.no right square bracket': "Høyre parentes mangler i slutten av liste",
	'jme.shunt.missing operator': "Uttrykket kan ikke evalueres -- operator mangler.",

	'jme.typecheck.function maybe implicit multiplication': "Operasjon %s er ikke definert. Mente du <br/><code>%s*%s(...)</code>?",
	'jme.typecheck.function not defined': "Operasjon '%s' er ikke definert. Mente du <br/><code>%s*(...)</code>?",
	'jme.typecheck.op not defined': "Operasjon '%s' er ikke definert.",
	'jme.typecheck.no right type definition': "Finner ikke definisjon av '%s' med korrekt type.",
	"jme.typecheck.no right type unbound name": "Variabel <code>%s<\/code> er ikke definert.",
	'jme.typecheck.map not on enumerable': "<code>map</code> operasjonen må gjelde en liste eller range, ikke %s",

	'jme.evaluate.undefined variable': "Variabel %s er udefinert",

	'jme.func.switch.no default case': "Switch-setning mangler standardverdi",
	'jme.func.listval.invalid index': "Ugyldig listeindeks %i for en liste med størrelse %i",
	'jme.func.listval.not a list': "Objektet kan ikke indekseres",
	'jme.func.matrix.invalid row type': "Kan ikke danne matrise ut fra rader av type %s",
	'jme.func.except.continuous range': "Kan ikke bruke operator 'except' på et kontinuerlig område.",

	'jme.texsubvars.no right bracket': "No matching <code>]</code> in %s arguments.",
	'jme.texsubvars.missing parameter': "Manglende parameter in %s: %s",
	'jme.texsubvars.no right brace': "No matching <code>}</code> in %s",

	'jme.user javascript.error': "Feil i brukerdefinert javascript funksjon <code>%s</code><br/>%s",
	'jme.user javascript.error': "Brukerdefinert javascript funksjon <code>%s</code> har ikke returverdi",

	'jme.variables.variable not defined': "Variabel %s er ikke definert.",
	'jme.variables.empty definition': "Definisjonen av variabel %s er tom.",
	'jme.variables.circular reference': "Sirkulær referanse til variabel i spørsmål %s %s",
	'jme.variables.error computing dependency': "Feil ved beregning av referert variabel <code>%s</code>",
	"jme.variables.error making function": "Feil med funksjonskode <code>%s<\/code>: %s",
	"jme.variables.syntax error in function definition": "Syntaxfeil i funksjonssdefinisjon",
	"jme.variables.error evaluating variable": "Feil ved evaluering av variabel %s: %s",

	'jme.display.unknown token type': "Can't texify token type %s",
	'jme.display.collectRuleset.no sets': 'No sets given to collectRuleset!',
	'jme.display.collectRuleset.set not defined': "Regelsett %s er ikke definert",
	'jme.display.simplifyTree.no scope given': "Numbas.jme.display.simplifyTree must be given a Scope",

	'math.precround.complex': "Kan ikke avrunde til antall desimaler gitt som komplekst tall",
	'math.siground.complex': "Kan ikke avrunde til antall signifikante siffer gitt som komplekst tall",
	'math.combinations.complex': "Kan ikke beregne kombinasjoner for komplekse tall",
	'math.permutations.complex': "Kan ikke beregne permutasjoner for komplekse tall",
	'math.gcf.complex': "Kan ikke beregne GCF for komplekse tall",
	'math.lcm.complex': "Kan ikke beregne LCM for komplekse tall",
	'math.lt.order complex numbers': "Kan ikke sortere komplekse tall",
	'math.choose.empty selection': "Slumpfunksjon har tomt tallområde",

	'matrixmath.abs.non-square': "Kan ikke beregne determinanten til en matrise som ikke er kvadratisk.",
	'matrixmath.abs.too big': "Kan ikke beregne determinanten til en matrise større enn 3x3.",
	'matrixmath.mul.different sizes': "Kan ikke multiplisere matriser med ulike dimensjoner.",

	'vectormath.cross.not 3d': "Kan bare beregne kryssprodukt til 3-dimensjonale vektorer.",
	'vectormath.dot.matrix too big': "Kan ikke beregne prikkproduktet til en matrise som ikke er $1 \\times N$ eller $N \\times 1$.",
	'vectormath.cross.matrix too big': "Kan ikke beregne kryssproduktet til en matrise som ikke er $1 \\times N$ eller $N \\times 1$.",

	'part.marking.steps no matter': "Ettersom du fikk alt riktig i oppgaven blir ikke delsvarene telt opp.",
	'part.marking.steps change single': "Du oppnådde <strong>%s</strong> poeng for delsvarene",
	'part.marking.steps change plural': "Du oppnådde <strong>%s</strong> poeng for delsvarene",
	'part.marking.revealed steps with penalty single': "Du valgte å se svarforslag. Maksimal poengsum for denne oppgaven er <strong>%s</strong> poeng. Din poengsum blir dermed redusert.",
	'part.marking.revealed steps with penalty plural': "Du valgte å se svarforslag. Maksimal poengsum for denne oppgaven er <strong>%s</strong> poeng. Din poengsum blir dermed redusert.",
	'part.marking.revealed steps no penalty': "Du valgte å se svarforslag.",
	'part.marking.not submitted': "Du svarte ikke",
	'part.marking.did not answer': "Du svarte ikke på dette spørsmålet.",
	'part.marking.total score single': "Du fikk <strong>%s</strong> poeng for denne oppgaven.",
	'part.marking.total score plural': "Du fikk <strong>%s</strong> poeng for denne oppgaven.",
	'part.marking.nothing entered': "Du svarte ikke.",
	'part.marking.incorrect': "Svaret er feil.",
	'part.marking.correct': "Svaret er riktig.",

	"part.correct answer": "Riktig svar:",
	"part.with steps answer prompt": "Svar: ",
	'part.missing type attribute': "Missing part type attribute",
	'part.unknown type': "Unrecognised part type %s",

	'part.setting not present': "Property '%s' not set in part %s of question \"%s\"",

	"part.script.error": "Feil i del %s av eget skript %s: %s",

	'part.jme.answer missing': "Korrekt svar for et JME felt mangler (%s)",
	'part.jme.answer too long': "Svaret er for langt.",
	'part.jme.answer too short': "Svaret er for kort.",
	'part.jme.answer invalid': "Svaret er ikke et gyldig matematisk uttrykk.<br/>%s",
	'part.jme.marking.correct': "Svaret er numerisk korrekt.",
	'part.jme.must-have bits': '<span class="monospace">%s</span>',
	'part.jme.must-have one': "Svaret må inneholde: %s",
	'part.jme.must-have several': "Svaret må inneholde alle: %s",
	'part.jme.not-allowed bits': '<span class="monospace">%s</span>',
	'part.jme.not-allowed one': "Svaret må ikke inneholde: %s",
	'part.jme.not-allowed several': "Svaret må ikke inneholde disse: %s",
	"part.jme.unexpected variable name": "Svaret ditt er tolket til å bruke det uventede variabelnavnet <code>%s</code>.",
	"part.jme.unexpected variable name suggestion": "Svaret ditt er tolket til å bruke det uventede variabelnavnet <code>%s</code>. Mente du <code>%s</code>?",

	'part.patternmatch.display answer missing': "Display answer is missing from a Pattern Match part (%s)",
	'part.patternmatch.correct except case': "Svaret er riktig, unntatt i dette tilfellet.",

	'part.numberentry.correct except decimal': "Svaret er i riktig intervall, men desimaltall er ikke tillatt.",
	'part.numberentry.answer invalid': "Du svarte ikke med et gyldig tall.",
	"part.numberentry.answer not integer": "Ditt svar er ikke gyldig. Tast inn et heltall, ikke desimaltall.",
	"part.numberentry.answer not integer or decimal": "Ditt svar er ikke gyldig. Tast inn et heltall eller et desimaltall.",

	'part.mcq.choices missing': "Svarmuligheter mangler i flervalgstesten (%s)",
	'part.mcq.matrix not a number': "Part %s marking matrix cell %s,%s does not evaluate to a number",
	'part.mcq.wrong number of choices': "Du merket av feil antall valg.",
	'part.mcq.no choices selected': "Du har ikke merket av i valgmuligheter.",
	'part.mcq.matrix not a list': "Marking matrix for a Multiple Response part, defined by JME expression, is not a list but it should be.",
	'part.mcq.correct choice': "Du valgte riktig svar.",
	"part.mcq.matrix wrong type": "Element av ugyldig type '%s' er brukt i score matrise.",
	"part.mcq.matrix mix of numbers and lists": "En blanding av tall og lister er brukt i score matrise.",
	"part.mcq.matrix wrong size": "Score matrise er av feil dimensjon.",

	'part.gapfill.feedback header': '<strong>Boks %i</strong>',
	
	"question.loaded name mismatch": "Kan ikke fortsette dette forsøket - pakken er endret siden siste sesjon.",
	"question.error": "Spørsmål %i: %s",
	"question.preamble.error": "Feil i startkoden: %s",
	"question.preamble.syntax error": "Syntaks feil i startkoden",
	'question.unsupported part type': "Unsupported part type",
	'question.header': "Spørsmål %i",
	'question.substituting': "Feil ved substituering av innhold: <br/>%s<br/>%s",
	'question.submit part': "Send inn svar",
	'question.show steps': "Vis tips",
	'question.advice': "Tips",
	'question.no such part': "Finner ikke spørsmål %s",
	'question.can not submit': "Kan ikke sende inn svar - sjekk mulige feil.",
	'question.answer submitted': "Svaret er sendt inn",
	
	'question.score feedback.show': 'Vis vurdering',
	'question.score feedback.hide': 'Skjul vurdering',
	'question.score feedback.answered total actual': "Poengsum: %(score)/%(marks)",
	'question.score feedback.answered total': "%(marksString). Besvart.",
	'question.score feedback.answered actual': "Poengsum: %(scoreString)",
	'question.score feedback.answered': "Besvart.",
	'question.score feedback.unanswered total': "%(marksString).",
	
	'timing.no accumulator': "no timing accumulator %s",
	'timing.time remaining': "Tid igjen: %s",
	
	'xml.could not load': "Kan ikke laste et XML dokument: %s",
	'xml.property not number': "Egenskap %s må være et tall, men er ikke (%s), i node %s",
	'xml.property not boolean': "Egenskap %s må være en boolsk verdi, men er ikke (%s), i node %s",
	"xml.error in variable definition": "Feil ved definisjon av variabel <code>%s<\/code>",

	'scorm.failed save': "Skriving av data til serveren feilet. Det er mulig at din økt med svar og poengsum ikke ble lagret. Vennligst send til <a href=\"mailto:numbas@ncl.ac.uk\">numbas@ncl.ac.uk</a> straks og behold dette vinduet i nettleseren åpent om mulig.",
	"scorm.no exam suspend data": "Kan ikke fortsette: finner ikke sesjonsdata.",
	"scorm.error loading suspend data": "Feil ved lasting av sesjonsdata: %s",
	"scorm.error loading question": "Feil ved lasting av spørsmål %s: %s",
	"scorm.no question suspend data": "Ingen sesjonsdata for spørsmål",
	"scorm.error loading part": "Feil ved lasting av del %s: %s",
	"scorm.no part suspend data": "Ingen sesjonsdata for delen",
	
	'mark': 'poeng',
	'marks': 'poeng',
	'was': 'var',
	'were': 'var'
});
});

Numbas.queueScript('settings',[],function() {
Numbas.rawxml = {
	templates: {
		question: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!--\nCopyright 2011-13 Newcastle University\n\n   Licensed under the Apache License, Version 2.0 (the \"License\");\n   you may not use this file except in compliance with the License.\n   You may obtain a copy of the License at\n\n       http://www.apache.org/licenses/LICENSE-2.0\n\n   Unless required by applicable law or agreed to in writing, software\n   distributed under the License is distributed on an \"AS IS\" BASIS,\n   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n   See the License for the specific language governing permissions and\n   limitations under the License.\n-->\n<xsl:stylesheet version=\"1.0\" xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\">\n<xsl:output method=\"xml\" version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\" indent=\"yes\" media-type=\"text/xhtml\" omit-xml-declaration=\"yes\"/>\n<xsl:strip-space elements=\"p\"/>\n\n<!-- this template just for viewing all questions in examXML outside SCORM -->\n<xsl:template match=\"exam\">\n	<html>\n		<body>\n			<xsl:apply-templates />\n		</body>\n	</html>\n</xsl:template>\n\n<!-- this is the thing that gets used by SCORM -->\n<xsl:template match=\"question\">\n	<div class=\"question clearAfter\" data-bind=\"with: question, visible: $root.exam.currentQuestionNumber()=={@number}\">\n		<h3 data-bind=\"text: displayName\" class=\"print-only\"></h3>\n		<xsl:apply-templates />\n	</div>\n</xsl:template>\n\n<xsl:template match=\"properties|feedbacksettings|preview|notes|variables|preprocessing|preambles\" />\n\n<xsl:template match=\"statement\">\n	<div class=\"statement\">\n		<xsl:apply-templates />\n	</div>\n</xsl:template>\n\n<xsl:template match=\"parts\">\n	<xsl:apply-templates />\n</xsl:template>\n\n<xsl:template match=\"part\" mode=\"path\">\n	<xsl:choose>\n		<xsl:when test=\"parent::gaps\">\n			<xsl:apply-templates select=\"../..\" mode=\"path\" />\n			<xsl:text>g</xsl:text>\n		</xsl:when>\n		<xsl:when test=\"parent::steps\">\n			<xsl:apply-templates select=\"../..\" mode=\"path\" />\n			<xsl:text>s</xsl:text>\n		</xsl:when>\n		<xsl:when test=\"parent::parts\">\n			<xsl:text>p</xsl:text>\n		</xsl:when>\n	</xsl:choose>\n	<xsl:value-of select=\"count(preceding-sibling::part)\" />\n</xsl:template>\n\n<xsl:template match=\"part\">\n	<xsl:variable name=\"path\">\n		<xsl:apply-templates select=\".\" mode=\"path\"/>\n	</xsl:variable>\n	<xsl:variable name=\"tag\">\n		<xsl:choose>\n			<xsl:when test=\"ancestor::gaps and not (choices)\">span</xsl:when>\n			<xsl:otherwise>div</xsl:otherwise>\n		</xsl:choose>\n	</xsl:variable>\n	<xsl:variable name=\"clear\">\n		<xsl:choose>\n			<xsl:when test=\"ancestor::gaps\"></xsl:when>\n			<xsl:otherwise><xsl:text>clearAfter</xsl:text></xsl:otherwise>\n		</xsl:choose>\n	</xsl:variable>\n\n	<xsl:if test=\"parent::parts\">\n		<xsl:if test=\"count(../part) &gt; 1\">\n			<h4 class=\"partheader\"><xsl:number count=\"part\" format=\"a) \"/></h4>\n		</xsl:if>\n	</xsl:if>\n	<xsl:element name=\"{$tag}\">\n		<xsl:attribute name=\"class\">part <xsl:value-of select=\"$clear\"/> type-<xsl:value-of select=\"@type\"/></xsl:attribute>\n		<xsl:attribute name=\"data-bind\">with: question.display.getPart('<xsl:value-of select=\"$path\" />')</xsl:attribute>\n\n		<xsl:if test=\"not(ancestor::gaps)\">\n			<xsl:apply-templates select=\"prompt\" />\n		</xsl:if>\n		<xsl:if test=\"count(steps/part)>0\">\n			<xsl:apply-templates select=\"steps\"/>\n		</xsl:if>\n		<span class=\"student-answer\" data-bind=\"css: {{dirty: isDirty}}\">\n			<xsl:apply-templates select=\".\" mode=\"typespecific\"/>\n			<span class=\"warning-icon icon-exclamation-sign\" data-bind=\"visible: warnings().length>0, hover: warningsShown, event: {{focus: showWarnings, blur: hideWarnings}}\" tabindex=\"0\"></span>\n			<span class=\"warnings\" data-bind=\"foreach: warnings, visible: warningsShown\">\n				<span class=\"warning\" data-bind=\"latex: message\"></span>\n			</span>\n		</span>\n		<xsl:apply-templates select=\".\" mode=\"correctanswer\"/>\n		<xsl:if test=\"not(ancestor::gaps)\">\n			<br/>\n			<div class=\"partFeedback\" data-bind=\"visible: marks()>0\">\n				<button class=\"btn submitPart\" data-bind=\"css: {{dirty: isDirty}}, click: controls.submit, slideVisible: !(revealed() || !isDirty())\"><localise>question.submit part</localise></button>\n				<div class=\"marks\" data-bind=\"pulse: scoreFeedback.update\">\n					<span class=\"score\" data-bind=\"html: scoreFeedback.message\"></span>\n					<span class=\"feedback-icon\" data-bind=\"css: scoreFeedback.iconClass, attr: scoreFeedback.iconAttr\"></span>\n				</div>\n				<button class=\"btn\" id=\"feedbackToggle\" data-bind=\"visible: showFeedbackToggler, click: controls.toggleFeedback, text: toggleFeedbackText\"></button>\n			</div>\n			<ol class=\"feedbackMessages\" data-bind=\"slideVisible: feedbackShown, foreach: feedbackMessages\">\n				<li class=\"feedbackMessage\" data-bind=\"latex: $data\"></li>\n			</ol>\n		</xsl:if>\n	</xsl:element>\n</xsl:template>\n\n<xsl:template match=\"steps\">\n\n	<div class=\"steps clearAfter\" data-bind=\"slideVisible: stepsOpen\">\n		<xsl:apply-templates select=\"part\"/>\n	</div>\n	<div class=\"stepsBtn\">\n		<button class=\"btn\" data-bind=\"visible: !stepsOpen(), click: controls.showSteps\"><localise>question.show steps</localise></button>\n		<button class=\"btn\" data-bind=\"visible: stepsOpen(), click: controls.hideSteps\"><localise>question.hide steps</localise></button>\n		<span class=\"penaltyMessage\">(<span data-bind=\"html: stepsPenaltyMessage\"></span>)</span>\n	</div>\n</xsl:template>\n\n<xsl:template match=\"prompt\">\n	<span class=\"prompt\">\n		<xsl:apply-templates />\n	</span>\n</xsl:template>\n\n<xsl:template match=\"content\">\n	<xsl:apply-templates select=\"*\" mode=\"content\" />\n</xsl:template>\n\n<xsl:template match=\"distractor\">\n	<span><xsl:apply-templates /></span>\n</xsl:template>\n\n\n<xsl:template match=\"advice\">\n	<div class=\"adviceContainer\" data-bind=\"visible: adviceDisplayed\">\n		<h3><localise>question.advice</localise></h3>\n		<span class=\"adviceDisplay\">\n			<xsl:apply-templates />\n		</span>\n	</div>\n</xsl:template>\n\n \n<xsl:template match=\"@*|node()\" mode=\"content\">\n	<xsl:copy>\n		<xsl:apply-templates select=\"@*|node()\" mode=\"content\" />\n	</xsl:copy>\n</xsl:template>\n\n<xsl:template match=\"part[@type='1_n_2']\" mode=\"typespecific\">\n	<xsl:apply-templates select=\"choices\" mode=\"one\"/>\n	<span class=\"feedback-icon\" data-bind=\"css: scoreFeedback.iconClass, attr: scoreFeedback.iconAttr\"></span>\n</xsl:template>\n\n<xsl:template match=\"part[@type='1_n_2']\" mode=\"correctanswer\">\n	<div class=\"correct-answer\" data-bind=\"visibleIf: showCorrectAnswer, typeset: showCorrectAnswer\">\n		<localise>part.correct answer</localise>\n		<xsl:apply-templates select=\"choices\" mode=\"correctanswer\"/>\n	</div>\n</xsl:template>\n\n<xsl:template match=\"part[@type='m_n_2']\" mode=\"typespecific\">\n	<xsl:apply-templates select=\"choices\" mode=\"one\"/>\n	<span class=\"feedback-icon\" data-bind=\"css: scoreFeedback.iconClass, attr: scoreFeedback.iconAttr\"></span>\n</xsl:template>\n\n<xsl:template match=\"part[@type='m_n_2']\" mode=\"correctanswer\">\n	<div class=\"correct-answer\" data-bind=\"visibleIf: showCorrectAnswer, typeset: showCorrectAnswer\">\n		<localise>part.correct answer</localise>\n		<xsl:apply-templates select=\"choices\" mode=\"correctanswer\"/>\n	</div>\n</xsl:template>\n\n<xsl:template match=\"choices\" mode=\"one\">\n	<xsl:variable name=\"displaytype\"><xsl:value-of select=\"@displaytype\"/></xsl:variable>\n	<form>\n	<xsl:choose>\n		<xsl:when test=\"@displaytype='radiogroup'\">\n			<ul class=\"multiplechoice clearAfter\">\n				<xsl:apply-templates select=\"choice\" mode=\"radiogroup\"/>\n			</ul>\n		</xsl:when>\n		<xsl:when test=\"@displaytype='checkbox'\">\n			<ul class=\"multiplechoice clearAfter\">\n				<xsl:apply-templates select=\"choice\" mode=\"checkbox\"/>\n			</ul>\n		</xsl:when>\n		<xsl:when test=\"@displaytype='dropdownlist'\">\n			<select class=\"multiplechoice\" data-bind=\"value: studentAnswer, disable: revealed\">\n				<option value=\"\"></option>\n				<xsl:apply-templates select=\"choice\" mode=\"dropdownlist\"/>\n			</select>\n		</xsl:when>\n	</xsl:choose>\n	</form>\n</xsl:template>\n\n<xsl:template match=\"choices\" mode=\"correctanswer\">\n	<xsl:variable name=\"displaytype\"><xsl:value-of select=\"@displaytype\"/></xsl:variable>\n	<form>\n	<xsl:choose>\n		<xsl:when test=\"@displaytype='radiogroup'\">\n			<ul class=\"multiplechoice clearAfter\">\n				<xsl:apply-templates select=\"choice\" mode=\"radiogroup-correctanswer\"/>\n			</ul>\n		</xsl:when>\n		<xsl:when test=\"@displaytype='checkbox'\">\n			<ul class=\"multiplechoice clearAfter\">\n				<xsl:apply-templates select=\"choice\" mode=\"checkbox-correctanswer\"/>\n			</ul>\n		</xsl:when>\n		<xsl:when test=\"@displaytype='dropdownlist'\">\n			<select class=\"multiplechoice\" data-bind=\"value: correctAnswer\" disabled=\"true\">\n				<option value=\"\"></option>\n				<xsl:apply-templates select=\"choice\" mode=\"dropdownlist-correctanswer\"/>\n			</select>\n		</xsl:when>\n	</xsl:choose>\n	</form>\n</xsl:template>\n\n<xsl:template match=\"choice\" mode=\"radiogroup\">\n	<xsl:variable name=\"cols\" select=\"../@displaycolumns\"/>\n	\n	<xsl:variable name=\"choicenum\"><xsl:value-of select=\"count(preceding-sibling::choice)\"/></xsl:variable>\n\n	<li>\n		<xsl:attribute name=\"class\">\n			<xsl:if test=\"($choicenum mod $cols = 0) and ($cols>0)\">\n				<xsl:text>start-column</xsl:text>\n			</xsl:if>\n		</xsl:attribute>\n		<label>\n			<input type=\"radio\" class=\"choice\" name=\"choice\" data-bind=\"checked: studentAnswer, disable: revealed\" value=\"{$choicenum}\"/>\n			<xsl:apply-templates select=\"content\"/>\n		</label>\n	</li>\n</xsl:template>\n<xsl:template match=\"choice\" mode=\"radiogroup-correctanswer\">\n	<xsl:variable name=\"cols\" select=\"../@displaycolumns\"/>\n	\n	<xsl:variable name=\"choicenum\"><xsl:value-of select=\"count(preceding-sibling::choice)\"/></xsl:variable>\n\n	<li>\n		<xsl:attribute name=\"class\">\n			<xsl:if test=\"($choicenum mod $cols = 0) and ($cols>0)\">\n				<xsl:text>start-column</xsl:text>\n			</xsl:if>\n		</xsl:attribute>\n		<label>\n			<input type=\"radio\" class=\"choice\" name=\"choice\" data-bind=\"checked: correctAnswer()+''\" disabled=\"true\" value=\"{$choicenum}\"/>\n			<xsl:apply-templates select=\"content\"/>\n		</label>\n	</li>\n</xsl:template>\n\n<xsl:template match=\"choice\" mode=\"checkbox\">\n	<xsl:variable name=\"cols\" select=\"../@displaycolumns\"/>\n\n	<xsl:variable name=\"choicenum\"><xsl:value-of select=\"count(preceding-sibling::choice)\"/></xsl:variable>\n\n	<li>\n		<xsl:attribute name=\"class\">\n			<xsl:if test=\"($choicenum mod $cols = 0) and ($cols>0)\">\n				<xsl:text>start-column</xsl:text>\n			</xsl:if>\n		</xsl:attribute>\n		<label>\n			<input type=\"checkbox\" class=\"choice\" name=\"choice\" data-bind=\"checked: ticks[{$choicenum}], disable: revealed\" />\n			<xsl:apply-templates select=\"content\"/>\n		</label>\n	</li>\n</xsl:template>\n\n<xsl:template match=\"choice\" mode=\"checkbox-correctanswer\">\n	<xsl:variable name=\"cols\" select=\"../@displaycolumns\"/>\n\n	<xsl:variable name=\"choicenum\"><xsl:value-of select=\"count(preceding-sibling::choice)\"/></xsl:variable>\n\n	<li>\n		<xsl:attribute name=\"class\">\n			<xsl:if test=\"($choicenum mod $cols = 0) and ($cols>0)\">\n				<xsl:text>start-column</xsl:text>\n			</xsl:if>\n		</xsl:attribute>\n		<label>\n			<input type=\"checkbox\" class=\"choice\" name=\"choice\" data-bind=\"checked: correctTicks[{$choicenum}]\" disabled=\"true\" />\n			<xsl:apply-templates select=\"content\"/>\n		</label>\n	</li>\n</xsl:template>\n\n<xsl:template match=\"choice\" mode=\"dropdownlist\">\n	\n	<xsl:variable name=\"choicenum\"><xsl:value-of select=\"count(preceding-sibling::choice)\"/></xsl:variable>\n	<option value=\"{$choicenum}\">\n		<xsl:apply-templates select=\"content\"/>\n	</option>\n</xsl:template>\n\n<xsl:template match=\"choice\" mode=\"dropdownlist-correctanswer\">\n	\n	<xsl:variable name=\"choicenum\"><xsl:value-of select=\"count(preceding-sibling::choice)\"/></xsl:variable>\n	<option value=\"{$choicenum}\">\n		<xsl:apply-templates select=\"content\"/>\n	</option>\n</xsl:template>\n\n<xsl:template match=\"part[@type='m_n_x']\" mode=\"typespecific\">\n	<xsl:variable name=\"displaytype\" select=\"choices/@displaytype\"/>\n	<form>\n		<table class=\"choices-grid\">\n			<thead>\n				<td/>\n				<xsl:for-each select=\"answers/answer\">\n					<th><xsl:apply-templates select=\"content\"/></th>\n				</xsl:for-each>\n			</thead>\n			<tbody>\n				<xsl:for-each select=\"choices/choice\">\n					<xsl:apply-templates select=\".\" mode=\"m_n_x\">\n						<xsl:with-param name=\"displaytype\" select=\"$displaytype\"/>\n					</xsl:apply-templates>\n				</xsl:for-each>\n			</tbody>\n		</table>\n	</form>\n	<span class=\"feedback-icon\" data-bind=\"css: scoreFeedback.iconClass, attr: scoreFeedback.iconAttr\"></span>\n</xsl:template>\n\n<xsl:template match=\"part[@type='m_n_x']\" mode=\"correctanswer\">\n	<xsl:variable name=\"displaytype\" select=\"choices/@displaytype\"/>\n	<div class=\"correct-answer\" data-bind=\"visibleIf: showCorrectAnswer, typeset: showCorrectAnswer\">\n		<localise>part.correct answer</localise>\n		<form>\n		<table class=\"choices-grid\">\n			<thead>\n				<td/>\n				<xsl:for-each select=\"answers/answer\">\n					<th><xsl:apply-templates select=\"content\"/></th>\n				</xsl:for-each>\n			</thead>\n			<tbody>\n				<xsl:for-each select=\"choices/choice\">\n					<xsl:apply-templates select=\".\" mode=\"m_n_x-correctanswer\">\n						<xsl:with-param name=\"displaytype\" select=\"$displaytype\"/>\n					</xsl:apply-templates>\n				</xsl:for-each>\n			</tbody>\n		</table>\n		</form>\n	</div>\n</xsl:template>\n\n<xsl:template match=\"choice\" mode=\"m_n_x\">\n	<xsl:param name=\"displaytype\"/>\n\n	<xsl:variable name=\"answers\" select=\"../../answers\"/>\n	<xsl:variable name=\"choicenum\" select=\"count(preceding-sibling::choice)\"/>\n	<tr>\n		<td class=\"choice\"><xsl:apply-templates select=\"content\"/></td>\n		<xsl:for-each select=\"$answers/answer\">\n			<xsl:variable name=\"answernum\" select=\"count(preceding-sibling::answer)\"/>\n			<td class=\"option\">\n				<xsl:choose>\n					<xsl:when test=\"$displaytype='checkbox'\">\n						<input type=\"checkbox\" class=\"choice\" name=\"choice-{$choicenum}\" data-bind=\"checked: ticks[{$answernum}][{$choicenum}], disable: revealed\" />\n					</xsl:when>\n					<xsl:when test=\"$displaytype='radiogroup'\">\n						<input type=\"radio\" class=\"choice\" name=\"choice-{$choicenum}\" data-bind=\"checked: ticks[{$choicenum}], disable: revealed\" value=\"{$answernum}\"/>\n					</xsl:when>\n				</xsl:choose>\n			</td>\n		</xsl:for-each>\n	</tr>\n</xsl:template>\n\n<xsl:template match=\"choice\" mode=\"m_n_x-correctanswer\">\n	<xsl:param name=\"displaytype\"/>\n\n	<xsl:variable name=\"answers\" select=\"../../answers\"/>\n	<xsl:variable name=\"choicenum\" select=\"count(preceding-sibling::choice)\"/>\n	<tr>\n		<td class=\"choice\"><xsl:apply-templates select=\"content\"/></td>\n		<xsl:for-each select=\"$answers/answer\">\n			<xsl:variable name=\"answernum\" select=\"count(preceding-sibling::answer)\"/>\n			<td class=\"option\">\n				<xsl:choose>\n					<xsl:when test=\"$displaytype='checkbox'\">\n						<input type=\"checkbox\" class=\"choice\" name=\"choice-{$choicenum}\" data-bind=\"checked: correctTicks[{$answernum}][{$choicenum}]\" disabled=\"true\"/>\n					</xsl:when>\n					<xsl:when test=\"$displaytype='radiogroup'\">\n						<input type=\"radio\" class=\"choice\" name=\"choice-{$choicenum}\" data-bind=\"checked: correctTicks[{$choicenum}]\" disabled=\"true\" value=\"{$answernum}\"/>\n					</xsl:when>\n				</xsl:choose>\n			</td>\n		</xsl:for-each>\n	</tr>\n</xsl:template>\n\n\n<xsl:template match=\"part[@type='patternmatch']\" mode=\"typespecific\">\n	<xsl:if test=\"count(steps/part)>0\"><localise>part.with steps answer prompt</localise></xsl:if>\n	<input type=\"text\" spellcheck=\"false\" class=\"patternmatch\" size=\"12.5\" data-bind=\"event: inputEvents, value: studentAnswer, valueUpdate: 'afterkeydown', autosize: true, disable: revealed\"></input>\n	<span class=\"feedback-icon\" data-bind=\"css: scoreFeedback.iconClass, attr: scoreFeedback.iconAttr\"></span>\n</xsl:template>\n\n<xsl:template match=\"part[@type='patternmatch']\" mode=\"correctanswer\">\n	<span class=\"correct-answer\" data-bind=\"visibleIf: showCorrectAnswer, typeset: showCorrectAnswer\">\n		<localise>part.correct answer</localise>\n		<input type=\"text\" spellcheck=\"false\" disabled=\"true\" class=\"patternmatch\" data-bind=\"value: displayAnswer, autosize: true\"/>\n	</span>\n</xsl:template>\n\n<xsl:template match=\"part[@type='gapfill']\" mode=\"typespecific\">\n</xsl:template>\n\n<xsl:template match=\"part[@type='gapfill']\" mode=\"correctanswer\">\n</xsl:template>\n\n<xsl:template match=\"gapfill\" mode=\"content\">\n	\n	<xsl:variable name=\"n\"><xsl:value-of select=\"@reference\"/></xsl:variable>\n	<xsl:apply-templates select=\"ancestor::part[1]/gaps/part[$n+1]\" />\n</xsl:template>\n\n<xsl:template match=\"part[@type='jme']\" mode=\"typespecific\">\n	<xsl:if test=\"count(steps/part)>0\"><localise>part.with steps answer prompt</localise></xsl:if>\n	<input type=\"text\" spellcheck=\"false\" class=\"jme\" data-bind=\"event: inputEvents, value: studentAnswer, valueUpdate: 'afterkeydown', autosize: true, disable: revealed\"/>\n	<span class=\"preview\" data-bind=\"visible: showPreview &amp;&amp; studentAnswerLaTeX(), maths: showPreview ? studentAnswerLaTeX() : '', click: focusInput\"></span>\n	<span class=\"feedback-icon\" data-bind=\"css: scoreFeedback.iconClass, attr: scoreFeedback.iconAttr\"></span>\n</xsl:template>\n\n<xsl:template match=\"part[@type='jme']\" mode=\"correctanswer\">\n	<span class=\"correct-answer\" data-bind=\"visibleIf: showCorrectAnswer, typeset: showCorrectAnswer\">\n		<localise>part.correct answer</localise>\n		<input type=\"text\" spellcheck=\"false\" disabled=\"true\" class=\"jme\" data-bind=\"value: correctAnswer, autosize: true\"/>\n		<span class=\"preview\" data-bind=\"maths: correctAnswerLaTeX\"></span>\n	</span>\n</xsl:template>\n\n<xsl:template match=\"part[@type='numberentry']\" mode=\"typespecific\">\n	<xsl:if test=\"count(steps/part)>0\"><localise>part.with steps answer prompt</localise></xsl:if>\n	<input type=\"text\" step=\"{answer/inputstep/@value}\" class=\"numberentry\" data-bind=\"event: inputEvents, value: studentAnswer, valueUpdate: 'afterkeydown', autosize: true, disable: revealed\"/>\n	<span class=\"preview\" data-bind=\"visible: showPreview &amp;&amp; studentAnswerLaTeX(), maths: showPreview ? studentAnswerLaTeX() : '', click: focusInput\"></span>\n	<span class=\"feedback-icon\" data-bind=\"css: scoreFeedback.iconClass, attr: scoreFeedback.iconAttr\"></span>\n</xsl:template>\n\n<xsl:template match=\"part[@type='numberentry']\" mode=\"correctanswer\">\n	<span class=\"correct-answer\" data-bind=\"visibleIf: showCorrectAnswer, typeset: showCorrectAnswer\">\n		<localise>part.correct answer</localise>\n		<input type=\"text\" spellcheck=\"false\" disabled=\"true\" class=\"jme\" data-bind=\"value: correctAnswer, autosize: true\"/>\n		<span data-bind=\"\"></span>\n	</span>\n</xsl:template>\n\n<xsl:template match=\"part[@type='matrix']\" mode=\"typespecific\">\n	<xsl:if test=\"count(steps/part)>0\"><localise>part.with steps answer prompt</localise></xsl:if>\n	<span><matrix-input params=\"rows: studentAnswerRows, columns: studentAnswerColumns, value: studentAnswer, allowResize: allowResize, disable: revealed\" data-bind=\"event: inputEvents\"></matrix-input></span>\n	<span class=\"preview\" data-bind=\"visible: showPreview &amp;&amp; studentAnswerLaTeX(), maths: showPreview ? studentAnswerLaTeX() : ''\"></span>\n	<span class=\"feedback-icon\" data-bind=\"css: scoreFeedback.iconClass, attr: scoreFeedback.iconAttr\"></span>\n</xsl:template>\n\n<xsl:template match=\"part[@type='matrix']\" mode=\"correctanswer\">\n	<span class=\"correct-answer\" data-bind=\"visibleIf: showCorrectAnswer, typeset: showCorrectAnswer\">\n		<localise>part.correct answer</localise>\n		<span data-bind=\"maths: correctAnswerLaTeX\"></span>\n	</span>\n</xsl:template>\n\n<xsl:template match=\"part[@type='information']\" mode=\"typespecific\">\n</xsl:template>\n\n<xsl:template match=\"part[@type='information']\" mode=\"correctanswer\">\n</xsl:template>\n\n<xsl:template match=\"part\" mode=\"typespecific\">\n	<localise>question.unsupported part type</localise> <xsl:text> </xsl:text> <xsl:value-of select=\"@type\"/>\n</xsl:template>\n\n<xsl:template match=\"part\" mode=\"correctanswer\">\n</xsl:template>\n\n<xsl:template match=\"math\" mode=\"content\">\n	<xsl:text> </xsl:text>\n	<span class=\"MathJax_Preview\"><xsl:value-of select=\"text()\"/></span>\n	<xsl:variable name=\"scripttype\">\n		<xsl:if test=\"name(..)='p' and count(../child::*)=1 and count(../child::text())=0 and name(../..)!='td' and count(ancestor::choice)=0 \" >\n			<xsl:text>; mode=display</xsl:text>\n		</xsl:if>\n	</xsl:variable>\n	<script type=\"math/tex{$scripttype}\"><xsl:value-of select=\"text()\"/></script>\n	<xsl:text> </xsl:text>\n</xsl:template>\n\n\n</xsl:stylesheet>"
	},

	examXML: "<exam name=\"tg_TR_integrasjonsregler_2\" percentPass=\"0%\">\n	<settings>\n		<navigation allowregen=\"true\" browse=\"True\" preventleave=\"False\" reverse=\"True\" showfrontpage=\"false\">\n			<event action=\"none\" type=\"onleave\">\n				<content>\n					<span>You have not finished the current question</span>\n				</content>\n			</event>\n		</navigation>\n		<timing allowPause=\"False\" duration=\"0\">\n			<event action=\"none\" type=\"timeout\">\n				<content>\n					<span />\n				</content>\n			</event>\n			<event action=\"none\" type=\"timedwarning\">\n				<content>\n					<span />\n				</content>\n			</event>\n		</timing>\n		<feedback allowrevealanswer=\"True\" showactualmark=\"True\" showanswerstate=\"True\" showtotalmark=\"True\">\n			<advice threshold=\"0\" type=\"onreveal\" />\n		</feedback>\n		<rulesets />\n	</settings>\n	<functions />\n	<variables />\n	<questions all=\"True\" pick=\"0\" shuffle=\"False\">\n		<question name=\"tg_TR_integrasjonsregler_2\">\n			<statement>\n				<content>\n					<span>\n						<p>Integrasjonsregler 2</p>\n						<p>$\\displaystyle\\begin {array}{l}\\int e^x dx \\;=\\; e^x+C&amp;&amp;\\text{(1) e-i-x} \\\\ \\int a^x dx \\;=\\;\\frac 1 {\\ln a}a^x + C&amp;&amp;\\text{(2) a-i-x}\\\\ \\int \\cos x \\,=\\; \\sin x + C&amp;&amp;\\text{(3)  cosinus}\\\\ \\int \\sin x \\,=\\; - \\cos x + C&amp;&amp;\\text{(4)  sinus}\\\\\\int (1 + \\tan^2 x)\\;dx\\;=\\;\\int \\frac 1 {\\cos^2 x} dx\\;=\\;\\tan x + C&amp;&amp;\\text{(5) tan-x}\\\\ \\int f(a x + b)\\;dx\\;=\\;\\frac 1 a F(a x + b) + C&amp;&amp;\\text{(6) Lineær-regelen}\\\\ \\int_a^b f(x)\\;dx\\;=\\;[F(x)]_a^b = F(b)-F(a)&amp;&amp;\\text{(7) Bestemt integral} \\end {array}$</p>\n					</span>\n				</content>\n			</statement>\n			<parts>\n				<part enableminimummarks=\"True\" marks=\"0\" minimummarks=\"0\" showcorrectanswer=\"True\" stepspenalty=\"0\" type=\"gapfill\">\n					<prompt>\n						<content>\n							<span>\n								<p style=\"padding-left: 30px;\">Syntakshjelp:<br />$e^{2 x}$ tastes som  <code>exp(2*x)</code>\n									<br />$\\ln x$ tastes som  <code>ln(x)</code>\n									<br />$\\sqrt x$  tastes som  <code>sqrt(x)</code>\n								</p>\n								<p>1 - Finn integralet:     $\\int -e^{- x}\\, dx$   =  <gapfill reference=\"0\" /> + C</p>\n								<p>2 - Finn integralet:     $\\int 8 \\cdot 10^{-3} \\cdot 2^x\\, dx $  =  <gapfill reference=\"1\" /> + C</p>\n								<p>3 - Finn integralet:     $\\int \\frac{e^{3 x}-3}{e^x}\\, dx $   =  <gapfill reference=\"2\" /> + C</p>\n								<p>4 - Finn integralet:     $\\int (e^{- 3 x} - 3^{2 x}) \\, dx $ = <gapfill reference=\"3\" /> + C</p>\n								<p>5 - Finn integralet:     $\\int (- \\sin (-x) + \\cos (2 x))\\, dx $   =  <gapfill reference=\"4\" /> + C</p>\n								<p>6 - Finn integralet:     $\\int \\tan^2(x) \\, dx $   =  <gapfill reference=\"5\" /> + C</p>\n								<p>7 - Finn integralet:     $\\displaystyle{\\int \\frac {4 x + 5}{x + 1} \\, dx }$ = <gapfill reference=\"6\" /> + C</p>\n								<p>8 - Finn integralet:     $\\displaystyle{\\int_1^5 \\frac {\\sqrt x} x \\, dx }$ = <gapfill reference=\"7\" />\n								</p>\n								<p>9 - Finn integralet:     $\\displaystyle{\\int_0^\\pi\\sin(\\frac x 4) \\, dx }$ = <gapfill reference=\"8\" />\n								</p>\n							</span>\n						</content>\n					</prompt>\n					<steps>\n						<part enableminimummarks=\"True\" marks=\"0\" minimummarks=\"0\" showcorrectanswer=\"True\" stepspenalty=\"0\" type=\"information\">\n							<prompt>\n								<content>\n									<span>\n										<p> WER QWE RQWEweq rqe</p>\n									</span>\n								</content>\n							</prompt>\n							<steps />\n							<scripts />\n						</part>\n					</steps>\n					<scripts />\n					<gaps>\n						<part enableminimummarks=\"True\" marks=\"1\" minimummarks=\"0\" showcorrectanswer=\"True\" stepspenalty=\"0\" type=\"jme\">\n							<prompt>\n								<content>\n									<span />\n								</content>\n							</prompt>\n							<steps />\n							<scripts />\n							<answer checkvariablenames=\"False\" showPreview=\"True\">\n								<correctanswer simplification=\"std\">\n									<math>exp(-x)</math>\n								</correctanswer>\n								<checking accuracy=\"0.001\" failurerate=\"1\" type=\"absdiff\">\n									<range end=\"1\" points=\"5\" start=\"0\" />\n								</checking>\n								<maxlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too long.</span>\n										</content>\n									</message>\n								</maxlength>\n								<minlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too short.</span>\n										</content>\n									</message>\n								</minlength>\n								<musthave partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer does not contain all required elements.</span>\n										</content>\n									</message>\n								</musthave>\n								<notallowed partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer contains elements which are not allowed.</span>\n										</content>\n									</message>\n								</notallowed>\n								<expectedvariablenames partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span />\n										</content>\n									</message>\n								</expectedvariablenames>\n							</answer>\n						</part>\n						<part enableminimummarks=\"True\" marks=\"1\" minimummarks=\"0\" showcorrectanswer=\"True\" stepspenalty=\"0\" type=\"jme\">\n							<prompt>\n								<content>\n									<span />\n								</content>\n							</prompt>\n							<steps />\n							<scripts />\n							<answer checkvariablenames=\"True\" showPreview=\"True\">\n								<correctanswer simplification=\"std\">\n									<math>(0.008*2^x)/ln(2)</math>\n								</correctanswer>\n								<checking accuracy=\"0.01\" failurerate=\"1\" type=\"absdiff\">\n									<range end=\"1\" points=\"5\" start=\"0\" />\n								</checking>\n								<maxlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too long.</span>\n										</content>\n									</message>\n								</maxlength>\n								<minlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too short.</span>\n										</content>\n									</message>\n								</minlength>\n								<musthave partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span />\n										</content>\n									</message>\n									<string>^</string>\n								</musthave>\n								<notallowed partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer contains elements which are not allowed.</span>\n										</content>\n									</message>\n								</notallowed>\n								<expectedvariablenames partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span />\n										</content>\n									</message>\n									<string>x</string>\n								</expectedvariablenames>\n							</answer>\n						</part>\n						<part enableminimummarks=\"True\" marks=\"1\" minimummarks=\"0\" showcorrectanswer=\"True\" stepspenalty=\"0\" type=\"jme\">\n							<prompt>\n								<content>\n									<span />\n								</content>\n							</prompt>\n							<steps />\n							<scripts />\n							<answer checkvariablenames=\"False\" showPreview=\"True\">\n								<correctanswer simplification=\"std\">\n									<math>exp(2*x)/2+3*exp(-x)</math>\n								</correctanswer>\n								<checking accuracy=\"0.001\" failurerate=\"1\" type=\"absdiff\">\n									<range end=\"1\" points=\"5\" start=\"0\" />\n								</checking>\n								<maxlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too long.</span>\n										</content>\n									</message>\n								</maxlength>\n								<minlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too short.</span>\n										</content>\n									</message>\n								</minlength>\n								<musthave partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer does not contain all required elements.</span>\n										</content>\n									</message>\n								</musthave>\n								<notallowed partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer contains elements which are not allowed.</span>\n										</content>\n									</message>\n								</notallowed>\n								<expectedvariablenames partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span />\n										</content>\n									</message>\n								</expectedvariablenames>\n							</answer>\n						</part>\n						<part enableminimummarks=\"True\" marks=\"1\" minimummarks=\"0\" showcorrectanswer=\"True\" stepspenalty=\"0\" type=\"jme\">\n							<prompt>\n								<content>\n									<span />\n								</content>\n							</prompt>\n							<steps />\n							<scripts />\n							<answer checkvariablenames=\"False\" showPreview=\"True\">\n								<correctanswer simplification=\"basic,unitFactor,unitPower,unitDenominator,zeroFactor,zeroTerm,zeroPower,collectNumbers,zeroBase,constantsFirst,sqrtProduct,sqrtDivision,sqrtSquare,otherNumbers\">\n									<math>exp(x)/2+3*exp(-x)</math>\n								</correctanswer>\n								<checking accuracy=\"0.001\" failurerate=\"1\" type=\"absdiff\">\n									<range end=\"1\" points=\"5\" start=\"0\" />\n								</checking>\n								<maxlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too long.</span>\n										</content>\n									</message>\n								</maxlength>\n								<minlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too short.</span>\n										</content>\n									</message>\n								</minlength>\n								<musthave partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer does not contain all required elements.</span>\n										</content>\n									</message>\n								</musthave>\n								<notallowed partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer contains elements which are not allowed.</span>\n										</content>\n									</message>\n								</notallowed>\n								<expectedvariablenames partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span />\n										</content>\n									</message>\n								</expectedvariablenames>\n							</answer>\n						</part>\n						<part enableminimummarks=\"True\" marks=\"1\" minimummarks=\"0\" showcorrectanswer=\"True\" stepspenalty=\"0\" type=\"jme\">\n							<prompt>\n								<content>\n									<span />\n								</content>\n							</prompt>\n							<steps />\n							<scripts />\n							<answer checkvariablenames=\"False\" showPreview=\"True\">\n								<correctanswer simplification=\"basic,unitFactor,unitPower,unitDenominator,zeroFactor,zeroTerm,zeroPower,collectNumbers,zeroBase,constantsFirst,sqrtProduct,sqrtDivision,sqrtSquare,otherNumbers\">\n									<math>sin(2*x)/2-cos(x)</math>\n								</correctanswer>\n								<checking accuracy=\"0.001\" failurerate=\"1\" type=\"absdiff\">\n									<range end=\"1\" points=\"5\" start=\"0\" />\n								</checking>\n								<maxlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too long.</span>\n										</content>\n									</message>\n								</maxlength>\n								<minlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too short.</span>\n										</content>\n									</message>\n								</minlength>\n								<musthave partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer does not contain all required elements.</span>\n										</content>\n									</message>\n								</musthave>\n								<notallowed partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer contains elements which are not allowed.</span>\n										</content>\n									</message>\n								</notallowed>\n								<expectedvariablenames partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span />\n										</content>\n									</message>\n								</expectedvariablenames>\n							</answer>\n						</part>\n						<part enableminimummarks=\"True\" marks=\"1\" minimummarks=\"0\" showcorrectanswer=\"True\" stepspenalty=\"0\" type=\"jme\">\n							<prompt>\n								<content>\n									<span />\n								</content>\n							</prompt>\n							<steps />\n							<scripts />\n							<answer checkvariablenames=\"False\" showPreview=\"True\">\n								<correctanswer simplification=\"basic,unitFactor,unitPower,unitDenominator,zeroFactor,zeroTerm,zeroPower,collectNumbers,zeroBase,constantsFirst,sqrtProduct,sqrtDivision,sqrtSquare,otherNumbers\">\n									<math>tan(x)-x</math>\n								</correctanswer>\n								<checking accuracy=\"0.001\" failurerate=\"1\" type=\"absdiff\">\n									<range end=\"1\" points=\"5\" start=\"0\" />\n								</checking>\n								<maxlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too long.</span>\n										</content>\n									</message>\n								</maxlength>\n								<minlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too short.</span>\n										</content>\n									</message>\n								</minlength>\n								<musthave partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer does not contain all required elements.</span>\n										</content>\n									</message>\n								</musthave>\n								<notallowed partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer contains elements which are not allowed.</span>\n										</content>\n									</message>\n								</notallowed>\n								<expectedvariablenames partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span />\n										</content>\n									</message>\n								</expectedvariablenames>\n							</answer>\n						</part>\n						<part enableminimummarks=\"True\" marks=\"1\" minimummarks=\"0\" showcorrectanswer=\"True\" stepspenalty=\"0\" type=\"jme\">\n							<prompt>\n								<content>\n									<span />\n								</content>\n							</prompt>\n							<steps />\n							<scripts />\n							<answer checkvariablenames=\"False\" showPreview=\"True\">\n								<correctanswer simplification=\"basic,unitFactor,unitPower,unitDenominator,zeroFactor,zeroTerm,zeroPower,collectNumbers,zeroBase,constantsFirst,sqrtProduct,sqrtDivision,sqrtSquare,otherNumbers\">\n									<math>log(x+1)+4*x</math>\n								</correctanswer>\n								<checking accuracy=\"0.001\" failurerate=\"1\" type=\"absdiff\">\n									<range end=\"1\" points=\"5\" start=\"0\" />\n								</checking>\n								<maxlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too long.</span>\n										</content>\n									</message>\n								</maxlength>\n								<minlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too short.</span>\n										</content>\n									</message>\n								</minlength>\n								<musthave partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer does not contain all required elements.</span>\n										</content>\n									</message>\n								</musthave>\n								<notallowed partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer contains elements which are not allowed.</span>\n										</content>\n									</message>\n								</notallowed>\n								<expectedvariablenames partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span />\n										</content>\n									</message>\n								</expectedvariablenames>\n							</answer>\n						</part>\n						<part enableminimummarks=\"True\" marks=\"1\" minimummarks=\"0\" showcorrectanswer=\"True\" stepspenalty=\"0\" type=\"jme\">\n							<prompt>\n								<content>\n									<span />\n								</content>\n							</prompt>\n							<steps />\n							<scripts />\n							<answer checkvariablenames=\"False\" showPreview=\"True\">\n								<correctanswer simplification=\"basic,unitFactor,unitPower,unitDenominator,zeroFactor,zeroTerm,zeroPower,collectNumbers,zeroBase,constantsFirst,sqrtProduct,sqrtDivision,sqrtSquare,otherNumbers\">\n									<math>2*sqrt(5)-2</math>\n								</correctanswer>\n								<checking accuracy=\"0.001\" failurerate=\"1\" type=\"absdiff\">\n									<range end=\"1\" points=\"5\" start=\"0\" />\n								</checking>\n								<maxlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too long.</span>\n										</content>\n									</message>\n								</maxlength>\n								<minlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too short.</span>\n										</content>\n									</message>\n								</minlength>\n								<musthave partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer does not contain all required elements.</span>\n										</content>\n									</message>\n								</musthave>\n								<notallowed partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer contains elements which are not allowed.</span>\n										</content>\n									</message>\n								</notallowed>\n								<expectedvariablenames partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span />\n										</content>\n									</message>\n								</expectedvariablenames>\n							</answer>\n						</part>\n						<part enableminimummarks=\"True\" marks=\"1\" minimummarks=\"0\" showcorrectanswer=\"True\" stepspenalty=\"0\" type=\"jme\">\n							<prompt>\n								<content>\n									<span />\n								</content>\n							</prompt>\n							<steps />\n							<scripts />\n							<answer checkvariablenames=\"False\" showPreview=\"True\">\n								<correctanswer simplification=\"basic,unitFactor,unitPower,unitDenominator,zeroFactor,zeroTerm,zeroPower,collectNumbers,zeroBase,constantsFirst,sqrtProduct,sqrtDivision,sqrtSquare,otherNumbers\">\n									<math>4-2^(3/2)</math>\n								</correctanswer>\n								<checking accuracy=\"0.001\" failurerate=\"1\" type=\"absdiff\">\n									<range end=\"1\" points=\"5\" start=\"0\" />\n								</checking>\n								<maxlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too long.</span>\n										</content>\n									</message>\n								</maxlength>\n								<minlength length=\"0\" partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer is too short.</span>\n										</content>\n									</message>\n								</minlength>\n								<musthave partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer does not contain all required elements.</span>\n										</content>\n									</message>\n								</musthave>\n								<notallowed partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span>Your answer contains elements which are not allowed.</span>\n										</content>\n									</message>\n								</notallowed>\n								<expectedvariablenames partialcredit=\"0%\" showstrings=\"False\">\n									<message>\n										<content>\n											<span />\n										</content>\n									</message>\n								</expectedvariablenames>\n							</answer>\n						</part>\n					</gaps>\n				</part>\n			</parts>\n			<advice>\n				<content>\n					<span>\n						<p />\n						<table cellpadding=\"0\" cellspacing=\"0\" class=\"mceLayout\" id=\"mce_6_tbl\" role=\"presentation\">\n							<tbody>\n								<tr class=\"mceLast\">\n									<td class=\"mceStatusbar mceFirst mceLast\" />\n								</tr>\n							</tbody>\n						</table>\n					</span>\n				</content>\n			</advice>\n			<notes />\n			<variables condition=\"\" maxRuns=\"100\" />\n			<functions />\n			<preambles nosubvars=\"true\">\n				<preamble language=\"css\" />\n				<preamble language=\"js\" />\n			</preambles>\n			<rulesets>\n				<set name=\"std\">\n					<include name=\"all\" />\n					<include name=\"!collectnumbers\" />\n					<include name=\"fractionnumbers\" />\n					<include name=\"!noLeadingMinus\" />\n				</set>\n			</rulesets>\n		</question>\n	</questions>\n</exam>"
};

});

/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/** @file Provides a storage API {@link Numbas.storage.SCORMstorage} which interfaces with SCORM */

Numbas.queueScript('scorm-storage',['base','SCORM_API_wrapper','storage'],function() {

/** SCORM storage object - controls saving and loading of data from the LMS 
 * @constructor
 * @memberof Numbas.storage
 * @augments Numbas.storage.BlankStorage
 */
var SCORMStorage = Numbas.storage.SCORMStorage = function()
{
	if(!pipwerks.SCORM.init())
	{
		var errorCode = pipwerks.SCORM.debug.getCode();
		if(errorCode) {
			throw(new Numbas.Error(R('scorm.error initialising',pipwerks.SCORM.debug.getInfo(errorCode))));
		}

		//if the pretend LMS extension is loaded, we can start that up
		if(Numbas.storage.PretendLMS)
		{
			if(!Numbas.storage.lms)
			{
				Numbas.storage.lms = new Numbas.storage.PretendLMS();
			}
			window.API_1484_11 = Numbas.storage.lms.API;
			pipwerks.SCORM.init();
		}
		//otherwise return a blank storage object which does nothing
		else
		{
			return new Numbas.storage.BlankStorage();	
		}
	}

	this.getEntry();

	//get all question-objective indices
	this.questionIndices = {};
	var numObjectives = parseInt(this.get('objectives._count'),10);
	for(var i=0;i<numObjectives;i++)
	{
		var id = this.get('objectives.'+i+'.id');
		this.questionIndices[id]=i;
	}

	//get part-interaction indices
	this.partIndices = {};
	var numInteractions = parseInt(this.get('interactions._count'),10);
	for(var i=0;i<numInteractions;i++)
	{
		var id = this.get('interactions.'+i+'.id');
		this.partIndices[id]=i;
	}
};

SCORMStorage.prototype = /** @lends Numbas.storage.SCORMstorage.prototype */ {
	/** Mode the session started in:
	 *
	 * * `ab-initio` - starting a new attempt
	 * * `resume` - loaded attempt in progress
	 */
	mode: 'ab-initio',
	
	/** reference to the {@link Numbas.Exam} object for the current exam */
	exam: undefined,			//reference to the main exam object

	/** Dictionary mapping question ids (of the form `qN`) to `cmi.objective` indices */
	questionIndices:{},		//associate question ids with objective indices

	/** Dictionary mapping {@link partpath} ids to `cmi.interaction` indices */
	partIndices:{},			//associate part ids with interaction indices

	/** The last `cmi.suspend_data` object 
	 * @type {json} 
	 */
	suspendData: undefined,	//save the suspend data so we don't have to keep fetching it off the server
	
	/** Save SCORM data - call the SCORM commit method to make sure the data model is saved to the server */
	save: function()
	{
		var exam = this.exam;
		function trySave() {
			exam.display.saving(true);
			var saved = pipwerks.SCORM.save();

			if(!saved) {
				Numbas.display.showAlert(R('scorm.failed save'),function(){
					setTimeout(trySave,1);
				});
			}
			else
				exam.display.saving(false);
		}
		trySave();
	},

	/** Set a SCORM data model element.
	 * @param {string} key - element name. This is prepended with `cmi.`
	 * @param {string} value - element value
	 * @returns {boolean} - did the call succeed?
	 */
	set: function(key,value)
	{
		//Numbas.debug("set "+key+" := "+value,true);
		var val = pipwerks.SCORM.set('cmi.'+key,value);
		//Numbas.debug(pipwerks.SCORM.debug.getCode(),true);
		return val;
	},

	/** Get a SCORM data model element
	 * @param {string} key - element name. This is prepended with `cmi.`
	 * @returns {string} - the value of the element
	 */
	get: function(key)
	{
		var val = pipwerks.SCORM.get('cmi.'+key);
		//Numbas.debug("get "+key+" = "+val,true);
		//Numbas.debug(pipwerks.SCORM.debug.getCode(),true);
		return val;
	},

	/** Make an id string corresponding to a question, of the form `qN`, where `N` is the question's number
	 * @param {Numbas.Question} question
	 * @returns {string}
	 */
	getQuestionId: function(question)
	{
		return 'q'+question.number;
	},

	/** Make an id string corresponding to a part, of the form `qNpXgYsZ`
	 * @param {Numbas.parts.Part} part
	 * @returns {string}
	 */
	getPartId: function(part)
	{
		return this.getQuestionId(part.question)+part.path;
	},


	/** Initialise the SCORM data model and this storage object.
	 * @param {Numbas.Exam} exam
	 */
	init: function(exam)
	{
		this.exam = exam;

		var set = this.set;

		this.set('completion_status','incomplete');
		this.set('exit','suspend');
		this.set('progress_measure',0);
		this.set('session_time','PT0H0M0S');
		this.set('success_status','unknown');
		this.set('score.scaled',0);
		this.set('score.raw',0);
		this.set('score.min',0);
		this.set('score.max',exam.mark);

		this.questionIndices = {};
		this.partIndices = {};

		for(var i=0; i<exam.settings.numQuestions; i++)
		{
			this.initQuestion(exam.questionList[i]);
		}

		this.setSuspendData();
	},

	/** Initialise a question - make an objective for it, and initialise all its parts.
	 * @param {Numbas.Question} q
	 */
	initQuestion: function(q)
	{
		var id = this.getQuestionId(q);

		var index = this.get('objectives._count');
		this.questionIndices[id] = index;

		var prepath = 'objectives.'+index+'.';

		this.set(prepath+'id', id);
		this.set(prepath+'score.min',0);
		this.set(prepath+'score.max',q.marks);
		this.set(prepath+'score.raw',q.score || 0);
		this.set(prepath+'success_status','unknown');
		this.set(prepath+'completion_status','not attempted');
		this.set(prepath+'progress_measure',0);
		this.set(prepath+'description',q.name);

		for(var i=0; i<q.parts.length;i++)
		{
			this.initPart(q.parts[i]);
		}
	},

	/** Initialise a part - make an interaction for it, and set up correct responses.
	 * @param {Numbas.parts.Part} part
	 */
	initPart: function(p)
	{
		var id = this.getPartId(p);

		var index = this.get('interactions._count');
		this.partIndices[id] = index;

		var prepath = 'interactions.'+index+'.';

		this.set(prepath+'id',id);
		this.set(prepath+'objectives.0.id',this.getQuestionId(p.question));
		this.set(prepath+'weighting',p.marks);
		this.set(prepath+'result',0);
		this.set(prepath+'description',p.type);
		switch(p.type)
		{
		case '1_n_2':
		case 'm_n_2':
		case 'm_n_x':
			this.set(prepath+'type','choice');
			
			var pattern='';
			for(var i=0;i<p.settings.matrix.length;i++)
			{
				for(var j=0;j<p.settings.matrix[i].length;j++)
				{
					if(p.settings.matrix[i][j]>0)
					{
						if(pattern.length>0){pattern+='[,]';}
						pattern+=i+'-'+j;
					}
				}
			}
			this.set(prepath+'correct_responses.0.pattern',pattern);

			break;
		case 'numberentry':
			this.set(prepath+'type','numeric');
			this.set(prepath+'correct_responses.0.pattern',Numbas.math.niceNumber(p.settings.minvalue)+'[:]'+Numbas.math.niceNumber(p.settings.maxvalue));
			break;
		case 'matrix':
			this.set(prepath+'type','fill-in');
			this.set(prepath+'correct_responses.0.pattern','{case_matters=false}{order_matters=false}'+JSON.stringify(p.settings.correctAnswer));
			break;
		case 'patternmatch':
			this.set(prepath+'type','fill-in');
			this.set(prepath+'correct_responses.0.pattern','{case_matters='+p.settings.caseSensitive+'}{order_matters=false}'+p.settings.correctAnswer);
			break;
		case 'jme':
			this.set(prepath+'type','fill-in');
			this.set(prepath+'correct_responses.0.pattern','{case_matters=false}{order_matters=false}'+p.settings.correctAnswer);
			break;
		case 'gapfill':
			this.set(prepath+'type','other');

			for(var i=0;i<p.gaps.length;i++)
			{
				this.initPart(p.gaps[i]);
			}
			break;
		}

		for(var i=0;i<p.steps.length;i++)
		{
			this.initPart(p.steps[i]);
		}
	},


	/** Save all the other stuff that doesn't fit into the standard SCORM data model using the `cmi.suspend_data` string.
	 */
	setSuspendData: function()
	{
		var exam = this.exam;
		if(exam.loading)
			return;
		var eobj = 
		{
			timeRemaining: exam.timeRemaining || 0,
			duration: exam.settings.duration || 0,
			questionSubset: exam.questionSubset,
			start: exam.start
		};

		eobj.questions = [];
		for(var i=0;i<exam.settings.numQuestions;i++)
		{
			eobj.questions.push(this.questionSuspendData(exam.questionList[i]));
		}
		
		this.set('suspend_data',JSON.stringify(eobj));
		this.suspendData = eobj;
	},

	/** Create suspend data object for a question
	 * @param {Numbas.Question} question
	 * @returns {object}
	 * @see Numbas.storage.SCORMstorage.setSuspendData
	 */
	questionSuspendData: function(question)
	{
		var qobj = 
		{
			name: question.name,
			visited: question.visited,
			answered: question.answered,
			submitted: question.submitted,
			adviceDisplayed: question.adviceDisplayed,
			revealed: question.revealed
		};

		qobj.variables = {};
		for(var name in question.scope.variables)
		{
			qobj.variables[name] = Numbas.jme.display.treeToJME({tok: question.scope.variables[name]},{});
		}

		qobj.parts = [];
		for(var i=0;i<question.parts.length;i++)
		{
			qobj.parts.push(this.partSuspendData(question.parts[i]));
		}

		return qobj;
	},

	/** Create suspend data object for a part
	 * @param {Numbas.parts.Part} part
	 * @returns {object}
	 * @see Numbas.storage.SCORMstorage.setSuspendData
	 */
	partSuspendData: function(part)
	{
		var pobj = {
			answered: part.answered,
			stepsShown: part.stepsShown,
			stepsOpen: part.stepsOpen
		};
		switch(part.type)
		{
		case 'gapfill':
			pobj.gaps=[];
			for(var i=0;i<part.gaps.length;i++)
			{
				pobj.gaps.push(this.partSuspendData(part.gaps[i]));
			}
			break;
		case '1_n_2':
		case 'm_n_2':
		case 'm_n_x':
			pobj.shuffleChoices = Numbas.math.inverse(part.shuffleChoices);
			pobj.shuffleAnswers = Numbas.math.inverse(part.shuffleAnswers);
			break;
		}

		pobj.steps = [];
		for(var i=0;i<part.steps.length;i++)
		{
			pobj.steps.push(this.partSuspendData(part.steps[i]));
		}

		return pobj;
	},

	/** Get the suspend data from the SCORM data model
	 * @returns {object}
	 */
	getSuspendData: function()
	{
		try {
			if(!this.suspendData)
			{
				var suspend_data = this.get('suspend_data');
				if(suspend_data.length)
					this.suspendData = JSON.parse(suspend_data);
			}
			if(!this.suspendData) {
				throw(new Numbas.Error('scorm.no exam suspend data'));
			}
		} catch(e) {
			throw(new Numbas.Error('scorm.error loading suspend data',e.message));
		}
		return this.suspendData;
	},

	/** Get suspended exam info
	 * @param {Numbas.Exam} exam
	 * @returns {exam_suspend_data}
	 */
	load: function(exam) 
	{
		this.exam = exam;
		var eobj = this.getSuspendData();
		this.set('exit','suspend');
		
		var currentQuestion = this.get('location');
		if(currentQuestion.length)
			currentQuestion=parseInt(currentQuestion,10);
		else
			currentQuestion=undefined;

		var score = parseInt(this.get('score.raw'),10);

		return {timeRemaining: eobj.timeRemaining || 0,
				duration: eobj.duration || 0 ,
				questionSubset: eobj.questionSubset,
				start: eobj.start,
				score: score,
				currentQuestion: currentQuestion
		};
	},

	/** Get suspended info for a question
	 * @param {Numbas.Question} question
	 * @returns {question_suspend_data}
	 */
	loadQuestion: function(question) 
	{
		try {
			var eobj = this.getSuspendData();
			var qobj = eobj.questions[question.number];
			if(!qobj) {
				throw(new Numbas.Error('scorm.no question suspend data'));
			}
			var id = this.getQuestionId(question);
			var index = this.questionIndices[id];

			var variables = {};
			for(var name in qobj.variables)
			{
				variables[name] = Numbas.jme.evaluate(qobj.variables[name],question.scope);
			}

			return {
					name: qobj.name,
					score: parseInt(this.get('objectives.'+index+'.score.raw') || 0,10),
					visited: qobj.visited,
					answered: qobj.answered,
					submitted: qobj.submitted,
					adviceDisplayed: qobj.adviceDisplayed,
					revealed: qobj.revealed,
					variables: variables
			};
		} catch(e) {
			throw(new Numbas.Error('scorm.error loading question',question.number,e.message));
		}
	},

	/** Get suspended info for a part
	 * @param {Numbas.parts.Part} part
	 * @returns {part_suspend_data}
	 */
	loadPart: function(part)
	{
		try {
			var eobj = this.getSuspendData();
			var pobj = eobj.questions[part.question.number];
			var re = /(p|g|s)(\d+)/g;
			while(m = re.exec(part.path))
			{
				var i = parseInt(m[2]);
				switch(m[1])
				{
				case 'p':
					pobj = pobj.parts[i];
					break;
				case 'g':
					pobj = pobj.gaps[i];
					break;
				case 's':
					pobj = pobj.steps[i];
					break;
				}
			}
			if(!pobj) {
				throw(new Numbas.Error('scorm.no part suspend data'));
			}

			var id = this.getPartId( part );
			var index = this.partIndices[id];
			var sc = this;
			function get(key) { return sc.get('interactions.'+index+'.'+key); };

			pobj.answer = get('learner_response');

			return pobj;
		} catch(e) {
			throw(new Numbas.Error('scorm.error loading part',part.path,e.message));
		}
	},

	/** Load a {@link Numbas.parts.JMEPart}
	 * @param {Numbas.parts.Part} part
	 * @returns {part_suspend_data}
	 */
	loadJMEPart: function(part)
	{
		var out = this.loadPart(part);
		out.studentAnswer = out.answer || '';
		return out;
	},

	/** Load a {@link Numbas.parts.PatternMatchPart}
	 * @param {Numbas.parts.Part} part
	 * @returns {part_suspend_data}
	 */
	loadPatternMatchPart: function(part)
	{
		var out = this.loadPart(part);
		out.studentAnswer = out.answer || '';
		return out;
	},

	/** Load a {@link Numbas.parts.NumberEntryPart}
	 * @param {Numbas.parts.Part} part
	 * @returns {part_suspend_data}
	 */
	loadNumberEntryPart: function(part)
	{
		var out = this.loadPart(part);
		out.studentAnswer = parseFloat(out.answer)==out.answer ? parseFloat(out.answer) : '';
		return out;
	},

	/** Load a {@link Numbas.parts.NumberEntryPart}
	 * @param {Numbas.parts.Part} part
	 * @returns {part_suspend_data}
	 */
	loadMatrixEntryPart: function(part)
	{
		var out = this.loadPart(part);
		if(out.answer) {
			out.studentAnswer = JSON.parse(out.answer);
		} else {
			out.studentAnswer = null;
		}
		return out;
	},

	/** Load a {@link Numbas.parts.MultipleResponsePart}
	 * @param {Numbas.parts.Part} part
	 * @returns {part_suspend_data}
	 */
	loadMultipleResponsePart: function(part)
	{
		var out = this.loadPart(part);

		if(part.numAnswers===undefined)
			return out;
		var ticks = [];
		var w = part.type=='m_n_x' ? part.numAnswers : part.numChoices;
		var h = part.type=='m_n_x' ? part.numChoices : part.numAnswers;
		if(w==0 || h==0) {
			out.ticks = [];
			return out;
		}
		for(var i=0;i<w;i++)
		{
			ticks.push([]);
			for(var j=0;j<h;j++)
			{
				ticks[i].push(false);
			}
		}
		var tick_re=/(\d+)-(\d+)/;
		var bits = out.answer.split('[,]');
		for(var i=0;i<bits.length;i++)
		{
			var m = bits[i].match(tick_re);
			if(m)
			{
				var x = parseInt(m[1],10);
				var y = parseInt(m[2],10);
				ticks[x][y]=true;
			}
		}
		out.ticks = ticks;
		return out;
	},

	/** Record duration of the current session
	 */
	setSessionTime: function()
	{
		var timeSpent = new Date((this.exam.settings.duration - this.exam.timeRemaining)*1000);
		var sessionTime = 'PT'+timeSpent.getHours()+'H'+timeSpent.getMinutes()+'M'+timeSpent.getSeconds()+'S';
		this.set('session_time',sessionTime);
	},


	/** Call this when the exam is started (when {@link Numbas.Exam#begin} runs, not when the page loads) */
	start: function() 
	{
		this.set('completion_status','incomplete');
	},

	/** Call this when the exam is paused ({@link Numbas.Exam#pause}) */
	pause: function() 
	{
		this.setSuspendData();
	},

	/** Call this when the exam is resumed ({@link Numbas.Exam#resume}) */
	resume: function() {},

	/** Call this when the exam ends ({@link Numbas.Exam#end}) */
	end: function()
	{
		this.setSessionTime();
		this.set('success_status',this.exam.passed ? 'passed' : 'failed');
		this.set('completion_status','completed');
		pipwerks.SCORM.quit();
	},

	/** Get the student's ID
	 * @returns {string}
	 */
	getStudentID: function() {
		var id = this.get('learner_id');
		return id || null;
	},

	/** Get entry state: `ab-initio`, or `resume`
	 * @returns {string}
	 */
	getEntry: function() 
	{
		return this.get('entry');
	},

	/** Get viewing mode: 
	 *
	 * * `browse` - see exam info, not questions
	 * * `normal` - sit exam
	 * * `review` - look at completed exam
	 * @returns {string}
	 */
	getMode: function() 
	{
		return this.get('mode');
	},

	/** Call this when the student moves to a different question
	 * @param {Numbas.Question} question
	 */
	changeQuestion: function(question)
	{
		this.set('location',question.number);	//set bookmark
		this.setSuspendData();	//because currentQuestion.visited has changed
	},

	/** Call this when a part is answered
	 * @param {Numbas.parts.Part} part
	 */
	partAnswered: function(part)
	{
		var id = this.getPartId(part);
		var index = this.partIndices[id];

		var prepath = 'interactions.'+index+'.';

		this.set(prepath+'result',part.score);

		switch(part.type)
		{
		case 'jme':
			this.set(prepath+'learner_response',part.studentAnswer);
			break;
		case 'patternmatch':
			this.set(prepath+'learner_response',part.studentAnswer);
			break;
		case 'numberentry':
			this.set(prepath+'learner_response',part.studentAnswer);
			break;
		case 'matrix':
			this.set(prepath+'learner_response',JSON.stringify(part.studentAnswer));
			break;
		case '1_n_2':
		case 'm_n_2':
		case 'm_n_x':
			var s='';
			for(var i=0;i<part.numAnswers;i++)
			{
				for( var j=0;j<part.numChoices;j++ )
				{
					if(part.ticks[i][j])
					{
						if(s.length){s+='[,]';}
						s+=i+'-'+j;
					}
				}
			}
			this.set(prepath+'learner_response',s);
			break;
		}
		this.setSuspendData();
	},

	/** Save exam-level details (just score at the mo)
	 * @param {Numbas.Exam} exam
	 */
	saveExam: function(exam)
	{
		if(exam.loading)
			return;

		//update total exam score and so on
		this.set('score.raw',exam.score);
		this.set('score.scaled',exam.score/exam.mark || 0);
	},

	/* Save details about a question - save score and success status
	 * @param {Numbas.Question} question
	 */
	saveQuestion: function(question) 
	{
		if(question.exam.loading)
			return;

		var id = this.getQuestionId(question);

		if(!(id in this.questionIndices))
			return;

		var index = this.questionIndices[id];


		var prepath = 'objectives.'+index+'.';

		this.set(prepath+'score.raw',question.score);
		this.set(prepath+'score.scaled',question.score/question.marks || 0);
		this.set(prepath+'success_status', question.score==question.marks ? 'passed' : 'failed' );
		this.set(prepath+'completion_status', question.answered ? 'completed' : 'incomplete' );
	},

	/** Record that a question has been submitted
	 * @param {Numbas.Question} question
	 */
	questionSubmitted: function(question)
	{
		this.save();
	},

	/** Record that the student displayed question advice
	 * @param {Numbas.Question} question
	 */
	adviceDisplayed: function(question)
	{
		this.setSuspendData();
	},

	/** Record that the student revealed the answers to a question
	 * @param {Numbas.Question} question
	 */
	answerRevealed: function(question)
	{
		this.setSuspendData();
		this.save();
	},

	/** Record that the student showed the steps for a part
	 * @param {Numbas.parts.Part} part
	 */
	stepsShown: function(part)
	{
		this.setSuspendData();
		this.save();
	},
	
	/** Record that the student hid the steps for a part
	 * @param {Numbas.parts.Part} part
	 */
	stepsHidden: function(part)
	{
		this.setSuspendData();
		this.save();
	}
	
};

});

Numbas.queueScript('jquery.xslTransform',['jquery','sarissa'],function(module) {
/**
 * xslTransform
 * Tools for XSLT transformations; jQuery wrapper for Sarissa <http://sarissa.sourceforge.net/>.
 * See jQuery.fn.log below for documentation on $.log().
 * See jQuery.fn.getTransform below for documention on the $.getTransform().
 * See var DEBUG below for turning debugging/logging on and off.
 *
 * @version   20071214
 * @since     2006-07-05
 * @copyright Copyright (c) 2006 Glyphix Studio, Inc. http://www.glyphix.com
 * @author    Brad Brizendine <brizbane@gmail.com>, Matt Antone <antone@glyphix.com>
 * @license   MIT http://www.opensource.org/licenses/mit-license.php
 * @requires  >= jQuery 1.0.3			http://jquery.com/
 * @requires  jquery.debug.js			http://jquery.glyphix.com/
 * @requires  >= sarissa.js 0.9.7.6		http://sarissa.sourceforge.net/
 *
 * @example
 * var r = $.xsl.transform('path-to-xsl.xsl','path-to-xml.xml');
 * @desc Perform a transformation and place the results in var r
 *
 * @example
 * var r = $.xsl.transform('path-to-xsl.xsl','path-to-xml.xml');
 * var str = $.xsl.serialize( r );
 * @desc Perform a transformation, then turn the result into a string
 *
 * @example
 * var doc = $.xsl.load('path-to-xml.xml');
 * @desc Load an xml file and return a parsed xml object
 *
 * @example
 * var xml = '<xmldoc><foo>bar</foo></xmldoc>';
 * var doc = $.xsl.load(xml);
 * @desc Load an xml string and return a parsed xml object
 */

(function($){

	/*
	 * JQuery XSLT transformation plugin.
	 * Replaces all matched elements with the results of an XSLT transformation.
	 * See xslTransform above for more documentation.
	 *
	 * @example
	 * @desc See the xslTransform-example/index.html
	 *
	 * @param xsl String the url to the xsl file
	 * @param xml String the url to the xml file
	 * @param options Object various switches you can send to this function
	 * 		+ params: an object of key/value pairs to be sent to xsl as parameters
	 * 		+ xpath: defines the root node within the provided xml file
	 * 		+ eval: if true, will attempt to eval javascript found in the transformed result
	 *		+ callback: if a Function, evaluate it when transformation is complete
	 * @returns
	 */
	$.fn.getTransform = function( xsl, xml, options ){
		var settings = {
			params: {},		// object of key/value pairs ... parameters to send to the XSL stylesheet
			xpath: '',		// xpath, used to send only a portion of the XML file to the XSL stylesheet
			eval: false,		// evaluate <script> blocks found in the transformed result
			callback: ''	// callback function, to be run on completion of the transformation
		};
		// initialize options hash; override the defaults with supplied options
		$.extend( settings, options );
		//$.log( 'getTransform: ' + xsl + '::' + xml + '::' + settings.toString() );

		// must have both xsl and xml
		if( !xsl || !xml ){
			$.log( 'getTransform: missing xsl or xml' );
			return;
		}

		// run the jquery magic on all matched elements
		return this.each( function(){
			// perform the transformation
			var trans = $.xsl.transform( xsl, xml, settings );

			// make sure we have something
			if( !trans.string ){
				$.log('Received nothing from the transformation');
				return false;
			}

			// ie can fail if there's an xml declaration line in the returned result
			var re = trans.string.match(/<\?xml.*?\?>/);
			if( re ){
				trans.string = trans.string.replace( re, '' );
				$.log( 'getTransform(): found an xml declaration and removed it' );
			}

			// place the result in the element
			// 20070202: jquery 1.1.1 can get a "a.appendChild is not a function" error using html() sometimes ...
			//		no idea why yet, so adding a fallback to innerHTML
			//		::warning:: ie6 has trouble with javascript events such as onclick assigned statically within the html when using innerHTML
			try{
				//$(this).html( trans.string );
				$(this)[0].innerHTML = trans.string;
			}catch(e){
				$.log( 'getTransform: error placing results of transform into element, falling back to innerHTML: ' + e.toString() );
				$(this)[0].innerHTML = trans.string;
			}

			
			// there might not be a scripts property
			if( settings.eval && trans.scripts ){
				if( trans.scripts.length > 0 ){
					$.log( 'Found text/javascript in transformed result' );
					// use jquery's globaleval to avoid security issues in adobe air
					$.globalEval( trans.scripts );
				}
			}

			// run the callback if it's a native function
			if( settings.callback && $.isFunction(settings.callback) ){
				settings.callback.apply();
			}

		});

	};

	// xsl scope
	$.xsl = {

		// version
		version: 20071214,

		// init ... test for requirements
		init: function(){
			// check for v1.0.4 / v1.1 or later of jQuery
			try{
				parseFloat($.fn.jquery) >= 1;
			}catch(e){
				alert('xslTransform requires jQuery 1.0.4 or greater ... please load it prior to xslTransform');
			}
			// check for Sarissa
			try{
				Sarissa;
			}catch(e){
				alert('Missing Sarissa ... please load it prior to xslTransform');
			}
			// if no log function, create a blank one
			if( !$.log ){
				$.log = function(){};
				$.fn.debug = function(){};
			}
			// log the version
			$.log( 'xslTransform:init(): version ' + this.version );
		},

		// initialize Sarissa's serializer
		XMLSerializer: new XMLSerializer(),

		/*
		 * serialize
		 * Turns the provided object into a string and returns it.
		 *
		 * @param data Mixed
		 * @returns String
		 */
		serialize: function( data ){
			$.log( 'serialize(): received ' + typeof(data) );
			// if it's already a string, no further processing required
			if( typeof(data) == 'string' ){
				$.log( 'data is already a string: ' + data );
				return data;
			}
			return this.XMLSerializer.serializeToString( data );
		},

		/*
		 * xmlize
		 * Turns the provided javascript object into an xml document and returns it.
		 *
		 * @param data Mixed
		 * @returns String
		 */
		xmlize: function( data, root ){
			$.log( 'xmlize(): received ' + typeof(data) );
			root = root || 'root';
			return Sarissa.xmlize(data,root);
		},

		/*
		 * load
		 * Attempts to load xml data by automatically sensing the type of the provided data.
		 *
		 * @param xml Mixed the xml data
		 * @returns Object
		 */
		load: function( xml ){
			$.log( 'load(): received ' + typeof(xml) );
			// the result
			var r;

			// if it's an object, assume it's already an XML object, so just return it
			if( typeof(xml) == 'object' ){
				return xml;
			}

			// if it's a string, determine if it's xml data or a path
			// assume that the first character is an opening caret if it's XML data
			if( xml.substring(0,1) == '<' ){
				r = this.loadString( xml );
			}else{
				r = this.loadFile( xml );
			}

			if( r ){
				// the following two lines are needed to get IE (msxml3) to run xpath ... set it on all xml data
				r.setProperty( 'SelectionNamespaces', 'xmlns:xsl="http://www.w3.org/1999/XSL/Transform"' );
				r.setProperty( 'SelectionLanguage', 'XPath' );
				return r;
			}else{
				$.log( 'Unable to load ' + xml );
				return false;
			}
		},

		/*
		 * loadString
		 * Parses an XML string and returns the result.
		 *
		 * @param str String the xml string to turn into a parsed XML object
		 * @returns Object
		 */
		loadString: function( str ){
			//$.log( 'loadString(): ' + str + '::' + typeof(str) );

			// use Sarissa to generate an XML doc
			var p = new DOMParser();
			var xml = p.parseFromString( str, 'text/xml' );
			if( !xml ){
				$.log( 'loadString(): parseFromString() failed' );
				return false;
			}
			return xml;
		},

		/*
		 * loadFile
		 * Attempts to retrieve the requested path, specified by url.
		 * If url is an object, it's assumed it's already loaded, and just returns it.
		 *
		 * @param url Mixed
		 * @returns Object
		 */
		loadFile: function( url ){
			//$.log( 'loadFile(): ' + url + '::' + typeof(url) );

			if( !url ){
				$.log( 'ERROR: loadFile() missing url' );
				return false;
			}

			// variable to hold ajax results
			var doc;
			/* ajax functionality provided by jQuery is commented, since it can't handle file:///
			// function to receive data on successful download ... semicolon after brace is necessary for packing
			this.xhrsuccess = function(data,str){
				$.log( 'loadFile() completed successfully (' + str + ')' );
				doc = data;
				return true;
			};
			// function to handle downloading error ... semicolon after brace is necessary for packing
			this.xhrerror = function(xhr,err){
				// set debugging to true in order to force the display of this error
				window.DEBUG = true;
				$.log( 'loadFile() failed to load the requested file: (' + err + ') - xml: ' + xhr.responseXML + ' - text: ' + xhr.responseText );
				doc = null;
				return false;
			};

			// make asynchronous ajax call and call functions defined above on success/error
			$.ajax({
				type:		'GET',
				url:		url,
				async:		false,
				success:	this.xhrsuccess,
				error:		this.xhrerror
			});
			*/

			var xmlhttp = new XMLHttpRequest();
			xmlhttp.open('GET', url, false);
			xmlhttp.send('');
			doc = xmlhttp.responseXML;

			// check for total failure
			if( !doc ){
				$.log( 'ERROR: document ' + url + ' not found (404), or unable to load' );
				return false;
			}
			// check for success but no data
			if( doc.length == 0 ){
				$.log( 'ERROR: document ' + url + ' loaded in loadFile() has no data' );
				return false;
			}
			return doc;
		},

		/*
		 * transform
		 * Central transformation function: takes an xml doc and an xsl doc.
		 *
		 * @param xsl Mixed the xsl transformation document
		 * @param xml Mixed the xml document to be transformed
		 * @param options Object various switches you can send to this function
		 * 		+ params: an object of key/value pairs to be sent to xsl as parameters
		 * 		+ xpath: defines the root node within the provided xml file
		 * @returns Object the results of the transformation
		 * 		+ xsl: the raw xsl doc
		 * 		+ doc: the raw results of the transform
		 * 		+ string: the serialized doc
		 */
		transform: function( xsl, xml, options ){
			//$.log( 'transform(): ' + xsl + '::' + xml + '::' + (options ? options.toString() : 'no options provided') );

			// set up request and result
			var request = {
				// the source and loaded object for xml
				xsl: {
					source: xsl,
					doc: null
				},
				// the source and loaded object for xsl
				xml: {
					source: xml,
					doc: null
				},
				// the options
				options: options || {},
				// the result doc and string
				result: {
					doc: null,
					string: '',
					scripts: null,
					error: ''
				}
			}

			// set up error handler
			var err = function( what ){
				var docerr = '', srcerr = '';
				// build the src error string
				srcerr = (typeof(request[what].source) == 'string') ? ' (' + what + ' loaded from provided path)' : ' (' + what + ' loaded from provided object)';
				// build the text error string
				docerr = (typeof(request[what].doc) == 'object') ? '[success]' : '[failure]';
				// include the root node if we have a doc object and it's xml
				if( what == 'xml' && typeof(request[what].doc) == 'object'  && request[what].doc.getElementsByTagName('*')[0]){
					docerr += ' root node of "' + request[what].doc.getElementsByTagName('*')[0].nodeName + '"';
				}
				return docerr + ' ' + srcerr;
			}

			// load the files
			try{
				request.xsl.doc = this.load(xsl);
				request.xml.doc = this.load(xml);
			}catch(e){
				$.log('Unable to load either xsl [' + err('xsl') + '] or xml [' + err('xml') + ']');
				throw( err('xsl') + '::' + err('xml') );
				return false;
			}

			// if we have an xpath, replace xml.doc with the results of running it
			// as of 2007-12-03, IE throws a "msxml6: the parameter is incorrect" error, so removing this
			if( request.options.xpath && request.xml.doc && !jQuery.browser.msie ){
				// run the xpath
				request.xml.doc = request.xml.doc.selectSingleNode( request.options.xpath.toString() );
				//$.log( 'transform(): xpath has been run...resulting doc: ' + (this.serialize(request.xml.doc)) );
			}

			// attach the processor
			var processor = new XSLTProcessor();
			// stylesheet must be imported before parameters can be added
			processor.importStylesheet( request.xsl.doc );
			// add parameters to the processor
			if( request.options.params && processor){
				//$.log( 'transform(): received xsl params: ' + request.options.params.toString() );
				for( key in request.options.params ){
					// name and value must be strings; first parameter is namespace
					var p = request.options.params[key] ? request.options.params[key].toString() : request.options.params[key];
					try{
						processor.setParameter( null, key.toString(), p );
					}catch(e){
						$.log('Unable to set parameter "' + key + '"');
						return false;
					}
					//$.log( 'set parameter "' + key.toString() + '" to "' + p + '"' );
				}
			}

			// perform the transformation
			try{
				request.result.doc = processor.transformToDocument( request.xml.doc );
				// handle transform error
				request.result.error = Sarissa.getParseErrorText( request.result.doc );
				if( request.result.error != Sarissa.PARSED_OK ){
					// throw the error text
					request.result.error = 'transform(): error in transformation: ' + request.result.error + ' :: using xsl: ' + err('xsl') + ' => xml: ' + err('xml');
					$.log(request.result.error);
				}
			}catch(e){
				request.result.error = 'Unable to perform transformation :: using xsl: ' + err('xsl') + ' => xml: ' + err('xml');
				$.log(request.result.error);
				throw(request.result.error);
				return request.result;
			}

			// if we made it this far, the transformation was successful
			request.result.string = this.serialize( request.result.doc );
			// store reference to all scripts found in the doc (not result.string)
			request.result.scripts = jQuery('script',request.result.doc).text();

			return request.result;
		}
	};

	// initialize the $.xsl object
	$.xsl.init();

})(jQuery);
});

/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/** @file Stuff to do with making new functions from JME or JavaScript code, 
 * generating question variables, 
 * and substituting variables into maths or the DOM 
 *
 * Provides {@link Numbas.jme.variables}
 */

Numbas.queueScript('jme-variables',['base','jme','util'],function() {

var jme = Numbas.jme;
var util = Numbas.util;

/** @namespace Numbas.jme.variables */

jme.variables = /** @lends Numbas.jme.variables */ {

	/** Make a new function, whose definition is written in JME.
	 * @param {object} fn - contains `definition` and `paramNames`.
	 * @param {Numbas.jme.Scope} scope
	 * @returns {function} - function which evaluates arguments and adds them to the scope, then evaluates `fn.definition` over that scope.
	 */
	makeJMEFunction: function(fn,scope) {
		fn.tree = jme.compile(fn.definition,scope,true);
		return function(args,scope) {
			var oscope = scope;
			scope = new jme.Scope(scope);

			for(var j=0;j<args.length;j++)
			{
				scope.variables[fn.paramNames[j]] = args[j];
			}
			return jme.evaluate(this.tree,scope);
		}
	},

	/** Make a new function, whose definition is written in JavaScript.
	 *
	 * The JavaScript is wrapped with `(function(<paramNames>){ ` and ` }`)
	 *
	 * @param {object} fn - contains `definition` and `paramNames`.
	 * @returns {function} - function which evaluates arguments, unwraps them to JavaScript values, then evalutes the JavaScript function and returns the result, wrapped as a {@link Numbas.jme.token}
	 */
	makeJavascriptFunction: function(fn) {
		var paramNames = fn.paramNames.slice();
		paramNames.push('scope');
		var preamble='fn.jfn=(function('+paramNames.join(',')+'){';
		var math = Numbas.math;
		var util = Numbas.util;
		try {
			var jfn = eval(preamble+fn.definition+'\n})');
		} catch(e) {
			throw(new Numbas.Error('jme.variables.syntax error in function definition'));
		}
		return function(args,scope) {
			args = args.map(function(a){return jme.unwrapValue(a)});
			args.push(scope);
			try {
				var val = jfn.apply(this,args);
				if(val===undefined) {
					throw(new Numbas.Error('jme.user javascript.returned undefined',fn.name));
				}
				val = jme.wrapValue(val);
				if(!val.type)
					val = new fn.outcons(val);
				return val;
			}
			catch(e)
			{
				throw(new Numbas.Error('jme.user javascript.error',fn.name,e.message));
			}
		}
	},

	/** Make a custom function.
	 *
	 * @param {object} tmpfn - contains `definition`, `name`, `language`, `parameters`
	 * @param {Numbas.jme.Scope} scope
	 * @returns {object} - contains `outcons`, `intype`, `evaluate`
	 */
	makeFunction: function(tmpfn,scope) {
		var intype = [],
			paramNames = [];

		tmpfn.parameters.map(function(p) {
			intype.push(jme.types[p.type]);
			paramNames.push(p.name);
		});

		var outcons = jme.types[tmpfn.outtype];

		var fn = new jme.funcObj(tmpfn.name,intype,outcons,null,true);

		fn.outcons = outcons;
		fn.intype = intype;
		fn.paramNames = paramNames;
		fn.definition = tmpfn.definition;
		fn.name = tmpfn.name;
		fn.language = tmpfn.language;

		try {
			switch(fn.language)
			{
			case 'jme':
				fn.evaluate = jme.variables.makeJMEFunction(fn,scope);
				break;
			case 'javascript':
				fn.evaluate = jme.variables.makeJavascriptFunction(fn,scope);
				break;
			}
		} catch(e) {
			throw(new Numbas.Error('jme.variables.error making function',fn.name,e.message));
		}
		return fn
	},

	/** Make up custom functions
	 * @param {object[]} tmpFunctions
	 * @param {Numbas.jme.Scope} scope
	 * @returns {object[]}
	 * @see Numbas.jme.variables.makeFunction
	 */
	makeFunctions: function(tmpFunctions,scope)
	{
		scope = new jme.Scope(scope);
		var functions = scope.functions;
		var tmpFunctions2 = [];
		for(var i=0;i<tmpFunctions.length;i++)
		{
			var cfn = jme.variables.makeFunction(tmpFunctions[i],scope);

			if(functions[cfn.name]===undefined)
				functions[cfn.name] = [];
			functions[cfn.name].push(cfn);

		}
		return functions;
	},

	/** Evaluate a variable, evaluating all its dependencies first.
	 * @param {string} name - the name of the variable to evaluate
	 * @param {object} todo - dictionary of variables still to evaluate
	 * @param {Numbas.jme.Scope} scope
	 * @param {string[]} path - Breadcrumbs - variable names currently being evaluated, so we can detect circular dependencies
	 * @return {Numbas.jme.token}
	 */
	computeVariable: function(name,todo,scope,path)
	{
		if(scope.variables[name]!==undefined)
			return scope.variables[name];

		if(path===undefined)
			path=[];


		if(path.contains(name))
		{
			throw(new Numbas.Error('jme.variables.circular reference',name,path));
		}

		var v = todo[name];

		if(v===undefined)
			throw(new Numbas.Error('jme.variables.variable not defined',name));

		//work out dependencies
		for(var i=0;i<v.vars.length;i++)
		{
			var x=v.vars[i];
			if(scope.variables[x]===undefined)
			{
				var newpath = path.slice(0);
				newpath.splice(0,0,name);
				try {
					jme.variables.computeVariable(x,todo,scope,newpath);
				}
				catch(e) {
					if(e.originalMessage == 'jme.variables.circular reference' || e.originalMessage == 'jme.variables.variable not defined') {
						throw(e);
					} else {
						throw(new Numbas.Error('jme.variables.error computing dependency',x));
					}
				}
			}
		}

		try {
			scope.variables[name] = jme.evaluate(v.tree,scope);
		} catch(e) {
			throw(new Numbas.Error('jme.variables.error evaluating variable',name,e.message));
		}
		return scope.variables[name];
	},

	/** Evaluate dictionary of variables
	 * @param {object} todo - dictionary of variables mapped to their definitions
	 * @param {Numbas.jme.Scope} scope
	 * @returns {object} - dictionary of evaluated variables
	 */
	makeVariables: function(todo,scope)
	{
		scope = new jme.Scope(scope);
		for(var x in todo)
		{
			jme.variables.computeVariable(x,todo,scope);
		}
		return scope.variables;
	},

	/** Substitute variables into a DOM element (works recursively on the element's children)
	 *
	 * Ignores iframes and elements with the attribute `nosubvars`.
	 * @param {Element} element
	 * @param {Numbas.jme.Scope} scope
	 */
	DOMcontentsubvars: function(element, scope) {
		if($.nodeName(element,'iframe'))
			return element;
		if(element.hasAttribute('nosubvars'))
			return element;

		var re_end;
		$(element).contents().each(function() {
			if(this.nodeType==(this.TEXT_NODE || 3)) {
				var selector = $(this);
				var str = this.nodeValue;
				var bits = util.contentsplitbrackets(str,re_end);	//split up string by TeX delimiters. eg "let $X$ = \[expr\]" becomes ['let ','$','X','$',' = ','\[','expr','\]','']
				re_end = bits.re_end;
				var i=0;
				var l = bits.length;
				for(var i=0; i<l; i+=4) {
					var textsubs = jme.variables.DOMsubvars(bits[i],scope,this.ownerDocument);
					for(var j=0;j<textsubs.length;j++) {
						selector.before(textsubs[j]);
					}
					var startDelimiter = bits[i+1] || '';
					var tex = bits[i+2] || '';
					var endDelimiter = bits[i+3] || '';
					var n = this.ownerDocument.createTextNode(startDelimiter+tex+endDelimiter);
					selector.before(n);
				}
				selector.remove();
			} else {
				jme.variables.DOMcontentsubvars(this,scope);
			}
		});
		return element;
	},

	/** Substitute variables into the contents of a text node. Substituted values might contain HTML elements, so the return value is a collection of DOM elements, not another string.
	 * @param {string} str - the contents of the text node
	 * @param {Numbas.jme.Scope} scope
	 * @param {Document} doc - the document the text node belongs to.
	 * @returns {Node[]} - array of DOM nodes to replace the string with
	 */
	DOMsubvars: function(str,scope,doc) {
		doc = doc || document;
		var bits = util.splitbrackets(str,'{','}');

		if(bits.length==1)
			return [doc.createTextNode(str)];

		function doToken(token) {
			switch(token.type){ 
			case 'html':
				return token.value;
			case 'number':
				return Numbas.math.niceNumber(token.value);
			case 'string':
				return token.value.replace(/\\([{}])/g,'$1');
			case 'list':
				return '[ '+token.value.map(function(item){return doToken(item)}).join(', ')+' ]';
			default:
				return jme.display.treeToJME({tok:token});
			}
		}

		var out = [];
		for(var i=0; i<bits.length; i++)
		{
			if(i % 2)
			{
				var v = jme.evaluate(jme.compile(bits[i],scope),scope);
				v = doToken(v);
			}
			else
			{
				v = bits[i];
			}
			if(typeof v == 'string') {
				if(out.length>0 && typeof out[out.length-1]=='string')
					out[out.length-1]+=v;
				else
					out.push(v);
			}
			else {
				out.push(v);
			}
		}
		for(var i=0;i<out.length;i++) {
			if(typeof out[i] == 'string') {
				var d = document.createElement('div');
				d.innerHTML = out[i];
				d = importNode(doc,d,true);
				out[i] = $(d).contents();
			}
		}
		return out;
	}
};


// cross-browser importNode from http://www.alistapart.com/articles/crossbrowserscripting/
// because IE8 is completely mentile and won't let you copy nodes between documents in anything approaching a reasonable way
function importNode(doc,node,allChildren) {
	var ELEMENT_NODE = 1;
	var TEXT_NODE = 3;
	var CDATA_SECTION_NODE = 4;
	var COMMENT_NODE = 8;

	switch (node.nodeType) {
		case ELEMENT_NODE:
			var newNode = doc.createElement(node.nodeName);
			var il;
			/* does the node have any attributes to add? */
			if (node.attributes && (il=node.attributes.length) > 0) {
				for (var i = 0; i < il; i++)
					newNode.setAttribute(node.attributes[i].nodeName, node.getAttribute(node.attributes[i].nodeName));
			}
			/* are we going after children too, and does the node have any? */
			if (allChildren && node.childNodes && (il=node.childNodes.length) > 0) {
				for (var i = 0; i<il; i++)
					newNode.appendChild(importNode(doc,node.childNodes[i], allChildren));
			}
			return newNode;
		case TEXT_NODE:
		case CDATA_SECTION_NODE:
			return doc.createTextNode(node.nodeValue);
		case COMMENT_NODE:
			return doc.createComment(node.nodeValue);
	}
};




});

Numbas.queueScript('jquery.impromptu',['jquery'],function(module) {
/*
 * jQuery Impromptu
 * By: Trent Richardson [http://trentrichardson.com]
 * Version 4.2
 * Last Modified: 01/25/2013
 * 
 * Copyright 2013 Trent Richardson
 * You may use this project under MIT or GPL licenses.
 * http://trentrichardson.com/Impromptu/GPL-LICENSE.txt
 * http://trentrichardson.com/Impromptu/MIT-LICENSE.txt
 * 
 */
 
(function($) {
	$.prompt = function(message, options) {
		$.prompt.options = $.extend({},$.prompt.defaults,options);
		$.prompt.currentPrefix = $.prompt.options.prefix;
		$.prompt.currentStateName = "";

		var $body	= $(document.body);
		var $window	= $(window);
		
		$.prompt.options.classes = $.trim($.prompt.options.classes);
		if($.prompt.options.classes != '')
			$.prompt.options.classes = ' '+ $.prompt.options.classes;
			
		//build the box and fade
		var msgbox = '<div class="'+ $.prompt.options.prefix +'box'+ $.prompt.options.classes +'">';
		if($.prompt.options.useiframe && ($('object, applet').length > 0)) {
			msgbox += '<iframe src="javascript:false;" style="display:block;position:absolute;z-index:-1;" class="'+ $.prompt.options.prefix +'fade"></iframe>';
		} else {
			msgbox +='<div class="'+ $.prompt.options.prefix +'fade"></div>';
		}
		msgbox += '<div class="'+ $.prompt.options.prefix +'"><div class="'+ $.prompt.options.prefix +'container"><div class="';
		msgbox += $.prompt.options.prefix +'close">X</div><div class="'+ $.prompt.options.prefix +'states"></div>';
		msgbox += '</div></div></div>';

		$.prompt.jqib = $(msgbox).appendTo($body);
		$.prompt.jqi	 = $.prompt.jqib.children('.'+ $.prompt.options.prefix);
		$.prompt.jqif	= $.prompt.jqib.children('.'+ $.prompt.options.prefix +'fade');

		//if a string was passed, convert to a single state
		if(message.constructor == String){
			message = {
				state0: {
					title: $.prompt.options.title,
					html: message,
				 	buttons: $.prompt.options.buttons,
				 	position: $.prompt.options.position,
				 	focus: $.prompt.options.focus,
				 	submit: $.prompt.options.submit
			 	}
		 	};
		}

		//build the states
		var states = "";

		$.each(message,function(statename,stateobj){
				stateobj = $.extend({},$.prompt.defaults.state,stateobj);
				message[statename] = stateobj;
				
				var arrow = "",
					title = "";
				if(stateobj.position.arrow !== null)
					arrow = '<div class="'+ $.prompt.options.prefix + 'arrow '+ $.prompt.options.prefix + 'arrow'+ stateobj.position.arrow +'"></div>';
				if(stateobj.title && stateobj.title !== '')
				    title = '<div class="'+ $.prompt.options.prefix + 'title">'+  stateobj.title +'</div>';
				states += '<div id="'+ $.prompt.options.prefix +'state_'+ statename +'" class="'+ $.prompt.options.prefix + 'state" style="display:none;">'+ arrow + title +'<div class="'+ $.prompt.options.prefix +'message">' + stateobj.html +'</div><div class="'+ $.prompt.options.prefix +'buttons">';
				
				$.each(stateobj.buttons, function(k, v){
					if(typeof v == 'object'){
						states += '<button ';
						
						if(typeof v.classes !== "undefined"){
							states += 'class="' + ($.isArray(v.classes)? v.classes.join(' ') : v.classes) + '" ';
						}
						
						states += ' name="' + $.prompt.options.prefix + '_' + statename + '_button' + v.title.replace(/[^a-z0-9]+/gi,'') + '" id="' + $.prompt.options.prefix + '_' + statename + '_button' + v.title.replace(/[^a-z0-9]+/gi,'') + '" value="' + v.value + '">' + v.title + '</button>';
						
					} else {
						states += '<button name="' + $.prompt.options.prefix + '_' + statename + '_button' + k + '" id="' + $.prompt.options.prefix +  '_' + statename + '_button' + k + '" value="' + v + '">' + k + '</button>';
						
					}
				});
				states += '</div></div>';
		});

		//insert the states...
		$.prompt.states = message;
		$.prompt.jqi.find('.'+ $.prompt.options.prefix +'states').html(states).children('.'+ $.prompt.options.prefix +'state:first').css('display','block');
		$.prompt.jqi.find('.'+ $.prompt.options.prefix +'buttons:empty').css('display','none');
		
		//Events
		$.each(message,function(statename,stateobj){
			var $state = $.prompt.jqi.find('#'+ $.prompt.options.prefix +'state_'+ statename);

			if($.prompt.currentStateName === "")
				$.prompt.currentStateName = statename;

			$state.bind('promptsubmit', stateobj.submit);
			
			$state.children('.'+ $.prompt.options.prefix +'buttons').children('button').click(function(){
				var $t = $(this),
					msg = $state.children('.'+ $.prompt.options.prefix +'message'),
					clicked = stateobj.buttons[$t.text()] || stateobj.buttons[$t.html()];
				if(clicked == undefined){
					for(var i in stateobj.buttons)
						if(stateobj.buttons[i].title == $t.text() || stateobj.buttons[i].title == $t.html())
							clicked = stateobj.buttons[i].value;
				}
				
				if(typeof clicked == 'object')
					clicked = clicked.value;
				var forminputs = {};

				//collect all form element values from all states
				$.each($.prompt.jqi.find('.'+ $.prompt.options.prefix +'states :input').serializeArray(),function(i,obj){
					if (forminputs[obj.name] === undefined) {
						forminputs[obj.name] = obj.value;
					} else if (typeof forminputs[obj.name] == Array || typeof forminputs[obj.name] == 'object') {
						forminputs[obj.name].push(obj.value);
					} else {
						forminputs[obj.name] = [forminputs[obj.name],obj.value];	
					} 
				});

				// trigger an event
				var promptsubmite = new $.Event('promptsubmit');
				promptsubmite.stateName = statename;
				promptsubmite.state = $state;
				$state.trigger(promptsubmite, [clicked, msg, forminputs]);
				
				if(!promptsubmite.isDefaultPrevented()){
					$.prompt.close(true, clicked,msg,forminputs);
				}
			});
			$state.find('.'+ $.prompt.options.prefix +'buttons button:eq('+ stateobj.focus +')').addClass($.prompt.options.prefix +'defaultbutton');

		});

		var fadeClicked = function(){
			if($.prompt.options.persistent){
				var offset = ($.prompt.options.top.toString().indexOf('%') >= 0? ($window.height()*(parseInt($.prompt.options.top,10)/100)) : parseInt($.prompt.options.top,10)),
					top = parseInt($.prompt.jqi.css('top').replace('px',''),10) - offset;

				//$window.scrollTop(top);
				$('html,body').animate({ scrollTop: top }, 'fast', function(){
					var i = 0;
					$.prompt.jqib.addClass($.prompt.options.prefix +'warning');
					var intervalid = setInterval(function(){
						$.prompt.jqib.toggleClass($.prompt.options.prefix +'warning');
						if(i++ > 1){
							clearInterval(intervalid);
							$.prompt.jqib.removeClass($.prompt.options.prefix +'warning');
						}
					}, 100);
				});
			}
			else {
				$.prompt.close(true);
			}
		};
		
		var keyPressEventHandler = function(e){
			var key = (window.event) ? event.keyCode : e.keyCode; // MSIE or Firefox?
			
			//escape key closes
			if(key==27) {
				fadeClicked();	
			}
			
			//constrain tabs
			if (key == 9){
				var $inputels = $(':input:enabled:visible',$.prompt.jqib);
				var fwd = !e.shiftKey && e.target == $inputels[$inputels.length-1];
				var back = e.shiftKey && e.target == $inputels[0];
				if (fwd || back) {
				setTimeout(function(){ 
					if (!$inputels)
						return;
					var el = $inputels[back===true ? $inputels.length-1 : 0];

					if (el)
						el.focus();						
				},10);
				return false;
				}
			}
		};
		
		$.prompt.position();
		$.prompt.style();
		
		$.prompt.jqif.click(fadeClicked);
		$window.resize({animate:false}, $.prompt.position);
		$.prompt.jqi.find('.'+ $.prompt.options.prefix +'close').click($.prompt.close);
		$.prompt.jqib.bind("keydown keypress",keyPressEventHandler)
					.bind('promptloaded', $.prompt.options.loaded)
					.bind('promptclose', $.prompt.options.close)
					.bind('promptstatechanging', $.prompt.options.statechanging)
					.bind('promptstatechanged', $.prompt.options.statechanged);

		//Show it
		$.prompt.jqif.fadeIn($.prompt.options.overlayspeed);
		$.prompt.jqi[$.prompt.options.show]($.prompt.options.promptspeed, function(){
			$.prompt.jqib.trigger('promptloaded');
		});
		$.prompt.jqi.find('.'+ $.prompt.options.prefix +'states .'+ $.prompt.options.prefix +'state:first .'+ $.prompt.options.prefix +'defaultbutton').focus();
		
		if($.prompt.options.timeout > 0)
			setTimeout($.prompt.close,$.prompt.options.timeout);

		return $.prompt.jqib;
	};
	
	$.prompt.defaults = {
		prefix:'jqi',
		classes: '',
		title: '',
		buttons: {
			Ok: true
		},
	 	loaded: function(e){},
	  	submit: function(e,v,m,f){},
	 	close: function(e,v,m,f){},
	 	statechanging: function(e, from, to){},
	 	statechanged: function(e, to){},
		opacity: 0.6,
	 	zIndex: 999,
	  	overlayspeed: 'slow',
	   	promptspeed: 'fast',
   		show: 'fadeIn',
	   	focus: 0,
	   	useiframe: false,
	 	top: '15%',
		position: { 
			container: null, 
			x: null, 
			y: null,
			arrow: null,
			width: null
		},
	  	persistent: true,
	  	timeout: 0,
	  	state: {
	  		title: '',
			html: '',
		 	buttons: {
		 		Ok: true
		 	},
		  	focus: 0,
		  	position: { 
		  		container: null, 
		  		x: null, 
		  		y: null,
		  		arrow: null,
		  		width: null
		  	},
		   	submit: function(e,v,m,f){
		   		return true;
		   }
	  	}
	};
	
	$.prompt.currentPrefix = $.prompt.defaults.prefix;
	
	$.prompt.currentStateName = "";
	
	$.prompt.setDefaults = function(o) {
		$.prompt.defaults = $.extend({}, $.prompt.defaults, o);
	};
	
	$.prompt.setStateDefaults = function(o) {
		$.prompt.defaults.state = $.extend({}, $.prompt.defaults.state, o);
	};

	$.prompt.position = function(e){
		var restoreFx = $.fx.off,
			$window = $(window),
			bodyHeight = $(document.body).outerHeight(true),
			windowHeight = $(window).height(),
			documentHeight = $(document).height(),
			height = bodyHeight > windowHeight ? bodyHeight : windowHeight,
			top = parseInt($window.scrollTop(),10) + ($.prompt.options.top.toString().indexOf('%') >= 0? 
					(windowHeight*(parseInt($.prompt.options.top,10)/100)) : parseInt($.prompt.options.top,10)),
			pos = $.prompt.states[$.prompt.currentStateName].position;

		// This fixes the whitespace at the bottom of the fade, but it is 
		// inconsistant and can cause an unneeded scrollbar, making the page jump
		//height = height > documentHeight? height : documentHeight;

		// when resizing the window turn off animation
		if(e !== undefined && e.data.animate === false)
			$.fx.off = true;
		
		$.prompt.jqib.css({
			position: "absolute",
			height: height,
			width: "100%",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0
		});
		$.prompt.jqif.css({
			position: "absolute",
			height: height,
			width: "100%",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0
		});

		// tour positioning
		if(pos && pos.container){
			var offset = $(pos.container).offset();
			
			if($.isPlainObject(offset) && offset.top !== undefined){
				$.prompt.jqi.css({
					position: "absolute"
				});
				$.prompt.jqi.animate({
					top: offset.top + pos.y,
					left: offset.left + pos.x,
					marginLeft: 0,
					width: (pos.width !== undefined)? pos.width : null
				});
				top = (offset.top + pos.y) - ($.prompt.options.top.toString().indexOf('%') >= 0? (windowHeight*(parseInt($.prompt.options.top,10)/100)) : parseInt($.prompt.options.top,10));
				$('html,body').animate({ scrollTop: top }, 'slow', 'swing', function(){});
			}
		}
		// custom state width animation
		else if(pos && pos.width){
			$.prompt.jqi.css({
					position: "absolute",
					left: '50%'
				});
			$.prompt.jqi.animate({
					top: pos.y || top,
					left: pos.x || '50%',
					marginLeft: ((pos.width/2)*-1),
					width: pos.width
				});
		}
		// standard prompt positioning
		else{
			$.prompt.jqi.css({
				position: "absolute",
				top: top,
				left: '50%',//$window.width()/2,
				marginLeft: (($.prompt.jqi.outerWidth()/2)*-1)
			});
		}

		// restore fx settings
		if(e !== undefined && e.data.animate === false)
			$.fx.off = restoreFx;
	};
	
	$.prompt.style = function(){
		$.prompt.jqif.css({
			zIndex: $.prompt.options.zIndex,
			display: "none",
			opacity: $.prompt.options.opacity
		});
		$.prompt.jqi.css({
			zIndex: $.prompt.options.zIndex+1,
			display: "none"
		});
		$.prompt.jqib.css({
			zIndex: $.prompt.options.zIndex
		});
	};

	$.prompt.getStateContent = function(state) {
		return $('#'+ $.prompt.currentPrefix +'state_'+ state);
	};
	
	$.prompt.getCurrentState = function() {
		return $('.'+ $.prompt.currentPrefix +'state:visible');
	};
	
	$.prompt.getCurrentStateName = function() {
		var stateid = $.prompt.getCurrentState().attr('id');
		
		return stateid.replace($.prompt.currentPrefix +'state_','');
	};
	
	$.prompt.goToState = function(state, callback) {
		var promptstatechanginge = new $.Event('promptstatechanging');
		$.prompt.jqib.trigger(promptstatechanginge, [$.prompt.currentStateName, state]);
		
		if(!promptstatechanginge.isDefaultPrevented()){
			$.prompt.currentStateName = state;
			
			$('.'+ $.prompt.currentPrefix +'state').slideUp('slow')
				.find('.'+ $.prompt.currentPrefix +'arrow').fadeOut();
			
			$('#'+ $.prompt.currentPrefix +'state_'+ state).slideDown('slow',function(){
				var $t = $(this);
				$t.find('.'+ $.prompt.currentPrefix +'defaultbutton').focus();
				$t.find('.'+ $.prompt.currentPrefix +'arrow').fadeIn('slow');
				
				if (typeof callback == 'function'){
					$.prompt.jqib.bind('promptstatechanged.tmp', callback);
				}
				$.prompt.jqib.trigger('promptstatechanged', [state]);
				if (typeof callback == 'function'){
					$.prompt.jqib.unbind('promptstatechanged.tmp');
				}
			});
		
			$.prompt.position();
		
		}
	};
	
	$.prompt.nextState = function(callback) {
		var $next = $('#'+ $.prompt.currentPrefix +'state_'+ $.prompt.currentStateName).next();
		$.prompt.goToState( $next.attr('id').replace($.prompt.currentPrefix +'state_',''), callback );
	};
	
	$.prompt.prevState = function(callback) {
		var $prev = $('#'+ $.prompt.currentPrefix +'state_'+ $.prompt.currentStateName).prev();
		$.prompt.goToState( $prev.attr('id').replace($.prompt.currentPrefix +'state_',''), callback );
	};
	
	$.prompt.close = function(callCallback, clicked, msg, formvals){
		$.prompt.jqib.fadeOut('fast',function(){

			if(callCallback) {
				$.prompt.jqib.trigger('promptclose', [clicked,msg,formvals]);
			}
			$.prompt.jqib.remove();
			
			$('window').unbind('resize',$.prompt.position);
			
		});
	};
	
	$.fn.extend({ 
		prompt: function(options){
			if(options == undefined) 
				options = {};
			if(options.withDataAndEvents == undefined)
				options.withDataAndEvents = false;
			
			$.prompt($(this).clone(options.withDataAndEvents).html(),options);
		}		
	});
	
})(jQuery);
});

Numbas.queueScript('R',[],function(module) {
/*jslint white: false, browser: true, devel: true, onevar: true, undef: true,
 nomen: true, eqeqeq: true, plusplus: false, bitwise: true, regexp: true,
 newcap: true, immed: true, maxlen: 100, indent: 4 */
/*globals module: false*/
/*
 * R.js - Internationalisation Library
 *
 * R.js is a simple Javascript Internationalisation library
 *
 * This code is licensed under the MIT
 * For more details, see http://www.opensource.org/licenses/mit-license.php
 * For more information, see http://github.com/keithcirkel/R.js
 *
 * @author Keith Cirkel ('keithamus') <rdotjs@keithcirkel.co.uk>
 * @license http://www.opensource.org/licenses/mit-license.php
 * @copyright Copyright © 2011, Keith Cirkel
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */
(function (exports) {
    var oldR = exports.R
    ,   inited = false
    ,   eR
    ,   undef
    ,   R = {
        
        init: function (lang) {
            lang = lang || typeof navigator !== undef ? navigator.language : 'en-GB';
            //Initialise some variables.
            eR.locales = {};
            eR.navLang = lang;
            inited = true;
        },
        
        slice: function (a) {
            return Array.prototype.slice.call(a);
        },
        
        AinOf: function (a, v) {
            for (var i = 0, c = a.length; i < c; ++i) if (a[i] === v) return i;
            return -1;
        },
        
        realTypeOf: function (v) {
            return Object.prototype.toString.call(v).match(/\w+/g)[1].toLowerCase();
        },
    
        render: function (id, args) {
            if (eR.locales && eR.locales.hasOwnProperty(eR.lang)) {
                if (eR.locales[eR.lang].hasOwnProperty(id)) {
                    id = eR.locales[eR.lang][id];
                }
            }
            
            // If we've no arguments, let's return
            if (!args || args.length === 0) {
                return id;
            }
    
            // Ok, we do have args, so lets parse them.
            args = R.parseVariables(args);
    
            return R.format(id, args);
        },
        
        parseVariables: function (args, ret) {
            var i
            ,   c
            ,   type = R.realTypeOf(args);
    
            // This is our structure for formatting, numbers go in i, string in s,
            // and the named arguments (i.e %(age)) go in named.
            if (!ret) {
                ret = { i: [], s: [], named: {} };
            }
    
            //Check args to see what type it is, and add to ret appropriately.
            switch (type) {
                case 'number': ret.i.push(args);             break;
                case 'string': ret.s.push(args);             break;
                case 'date':   ret.i.push(args.toString());  break;
                case 'object':
                    for (i in args) {
                        if (args.hasOwnProperty(i)) {
                            if (i === 'i' || i === 's') {
                                R.parseVariables(args[i], ret);
                            } else {
                                ret.named[i] = args[i];
                            }
                        }
                    }
                    break;
                case 'array':
                    // Loop through the array, doing what we just did
                    for (i = 0, c = args.length; i < c; ++i) {
                        R.parseVariables(args[i], ret);
                    }
                    break;
            }
    
            return ret;
        },

        format: function (s, a) {
            var i
            ,   replace
            ,   tcount
            ,   substrstart
            ,   type
            ,   l
            ,   types = {i: '%i', s: '%s'}
            ,   tmp = ''
            ,   t;
            
            //First we'll add all integers to the pot, then the strings
            for (type in types) {
                if (types.hasOwnProperty(type)) {
                    tcount = (s.match(new RegExp(types[type], 'g')) || []).length;
                    for (i = 0; i < tcount; ++i) {
                        replace = a[type].hasOwnProperty(i) ? a[type][i] : replace;
                        if (replace !== undef && replace !== false) {
                            if ((substrstart = s.indexOf(types[type])) >= 0) {
                                s = s.substr(0, substrstart) + replace + s.substr(substrstart + 2);
                            }
                        }
                    }
                }
                replace = false;
            }
    
            //Now to loop through the named arguments!
            for (i in a.named) {
                if (a.named.hasOwnProperty(i)) {
                    t = new RegExp("%\\(" + i + "\\)", 'g');
                    s = s.replace(t, a.named[i]);
                }
            }
    
            return s;
        }
    };
    
    /*
     * R
     * Take an `id` from the registered locales and return the string including any variables.
     * @param {String} id The ID of the
     * @param {Mixed} variables
     */
    eR = function (id, variables) {
        // If we haven't initialised our variables etc, then do so.
        if (!inited) R.init();
        
        if (arguments.length > 1) {
            
            // In the case we've been given comma separated arguments, we should
            // load them into an array and send them to render
            var args = R.slice(arguments);
            args.shift();
        
            return R.render(id, args);

        // Otherwise just send the `variables` var.
        } else {
            return R.render(id, [variables]);
        }
    };
    
    /*
     * R.registerLocale
     * Apply `object` of strings to `locale` for use with the main function, R
     * @param {String} locale The locale of the language object, e.g en-US
     * @param {Object} A flat object of strings
     */
    eR.registerLocale = function (locale, object) {
        //If we haven't initialised our variables etc, then do so.
        if (!inited) R.init();
        
        //Throw the object we've been given into locales.
        eR.locales[locale] = object;
        eR.setLocale(eR.navlang);
        return eR;
    };
    
    /*
     * R.localeOrder
     * Change the order of locales, to enable negotiation of a locale with setLocale
     * @param {String} locale The locale that should be set
     */
    eR.localeOrder = function () {
        eR.preferredLocales = R.slice(arguments);
        return eR.setLocale(eR.lang);
    };
        
    /*
     * R
     * Set the `locale` to a different locale
     * @param {String} locale The locale that should be set
     */
    eR.setLocale = function (locale, force) {
        //If we haven't initialised our variables etc, then do so.
        if (!inited) R.init();
        
        if (force) {
            eR.lang = locale;
            return eR;
        }
        var i = 0, key, locales = eR.preferredLocales;
        if (!locales) {
            locales = [];
            for (key in eR.locales) {
                if (eR.locales.hasOwnProperty(key)) locales.push(key);
            }
        }
        if ((key = R.AinOf(locales, locale)) > 0) {
            eR.lang = locales[key];
            return eR;
        }
        eR.lang = locales[0] || locale;
        return eR;
    };
    
    eR.noConflict = function () {
        exports.R = oldR;
        return eR;
    };
    
    exports.R = eR;

}(typeof module !== 'undefined' && module.exports ? module.exports : this));
});

/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/** @file Provides {@link Numbas.schedule} */

Numbas.queueScript('schedule',['base'],function() {

/** Schedule functions to be called. The scheduler can put tiny timeouts in between function calls so the browser doesn't become unresponsive. It also updates the loading bar.
 * @namespace Numbas.schedule 
 */

Numbas.schedule = /** @lends Numbas.schedule */ {

	/** Functions to call 
	 * @type {function[]}
	 */
	calls: [],

	/** Bits of queue that have been picked up while a task performs sub-tasks 
	 * @type {Array.Array.<function>} */
	lifts: [],

	/** Number of tasks completed 
	 * @type {number}
	 */
	completed: 0,

	/** Total number of tasks ever scheduled
	 * @type {number}
	 */
	total: 0,

	/** Should the scheduler stop running tasks?
	 * @type {boolean}
	 */
	halt:false,

	/** Add a task to the queue
	 * @param {function|object} fn - the function to run, or a dictionary `{task: fn, error: fn}`, where `error` is a callback if an error is caused
	 * @param {object} that - what `this` should be when the function is called
	 */
	add: function(fn,that)
	{
		var schedule = Numbas.schedule;

		if(schedule.halt)
			return;

		var args = [],l=arguments.length;
		for(var i=2;i<l;i++)
		{
			args[i-2]=arguments[i];
		}

		if(typeof(fn)=='function') {
			fn = {task: fn};
		}

		var task = function()
		{
			try {
				fn.task.apply(that,args);
			} catch(e) {
				if(fn.error) {
					fn.error(e);
				} else {
					throw(e);
				}
			}
		};
		
		schedule.calls.push(task);
		setTimeout(schedule.pop,0);

		schedule.total++;
	},

	/** Pop the first task off the queue and run it.
	 *
	 * If there's an error, the scheduler halts and shows the error.
	 */
	pop: function()
	{
		var schedule = Numbas.schedule;

		var calls = schedule.calls;
		if(!calls.length || schedule.halt){return;}

		var task = calls.shift();

		schedule.lift();
		try {
			task();
		}
		catch(e) {
			Numbas.display.die(e);
			schedule.halt = true;
		}
		schedule.drop();

		schedule.completed++;

		Numbas.display.showLoadProgress();
	},

	/** 'pick up' the current queue and put stuff in front. Called before running a task, so it can queue things which must be done before the rest of the queue is called */
	lift: function()
	{
		var schedule = Numbas.schedule;

		schedule.lifts.push(schedule.calls);
		schedule.calls=new Array();
	},

	/** Put the last lifted queue back on the end of the real queue */
	drop:function()
	{
		var schedule = Numbas.schedule;

		schedule.calls = schedule.calls.concat(schedule.lifts.pop());
	}
};

});

/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/** @file Mathematical functions, providing stuff that the built-in `Math` object doesn't, as well as vector and matrix math operations. 
 *
 * Provides {@link Numbas.math}, {@link Numbas.vectormath} and {@link Numbas.matrixmath}
 */

Numbas.queueScript('math',['base'],function() {

/** Mathematical functions, providing stuff that the built-in `Math` object doesn't
 * @namespace Numbas.math */

/** @typedef complex
 * @property {number} re
 * @property {number} im
 */

/** @typedef range
 * @desc A range of numbers, separated by a constant intervaland between fixed lower and upper bounds.
 * @type {number[]}
 * @property {number} 0 Minimum value
 * @property {number} 1 Maximum value
 * @property {number} 2 Step size
 * @see Numbas.math.defineRange
 */

var math = Numbas.math = /** @lends Numbas.math */ {

	/** Regex to match numbers in scientific notation */
	re_scientificNumber: /(\-?(?:0|[1-9]\d*)(?:\.\d+)?)[eE]([\+\-]?\d+)/,
	
	/** Construct a complex number from real and imaginary parts.
	 *
	 * Elsewhere in this documentation, `{number}` will refer to either a JavaScript float or a {@link complex} object, interchangeably.
	 * @param {number} re
	 * @param {number} im
	 * @returns {complex}
	 */
	complex: function(re,im)
	{
		if(!im)
			return re;
		else
			return {re: re, im: im, complex: true, 
			toString: math.complexToString}
	},
	
	/** String version of a complex number
	 * @returns {string}
	 * @method
	 * @memberof! complex
	 */
	complexToString: function()
	{
		return math.niceNumber(this);
	},

	/** Negate a number.
	 * @param {number} n
	 * @returns {number}
	 */
	negate: function(n)
	{
		if(n.complex)
			return math.complex(-n.re,-n.im);
		else
			return -n;
	},

	/** Complex conjugate
	 * @param {number} n
	 * @returns {number}
	 */
	conjugate: function(n)
	{
		if(n.complex)
			return math.complex(n.re,-n.im);
		else
			return n;
	},

	/** Add two numbers
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 */
	add: function(a,b)
	{
		if(a.complex)
		{
			if(b.complex)
				return math.complex(a.re+b.re, a.im + b.im);
			else
				return math.complex(a.re+b, a.im);
		}
		else
		{
			if(b.complex)
				return math.complex(a + b.re, b.im);
			else
				return a+b;
		}
	},

	/** Subtract one number from another
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 */
	sub: function(a,b)
	{
		if(a.complex)
		{
			if(b.complex)
				return math.complex(a.re-b.re, a.im - b.im);
			else
				return math.complex(a.re-b, a.im);
		}
		else
		{
			if(b.complex)
				return math.complex(a - b.re, -b.im);
			else
				return a-b;
		}
	},

	/** Multiply two numbers
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 */
	mul: function(a,b)
	{
		if(a.complex)
		{
			if(b.complex)
				return math.complex(a.re*b.re - a.im*b.im, a.re*b.im + a.im*b.re);
			else
				return math.complex(a.re*b, a.im*b);
		}
		else
		{
			if(b.complex)
				return math.complex(a*b.re, a*b.im);
			else
				return a*b;
		}
	},

	/** Divide one number by another
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 */
	div: function(a,b)
	{
		if(a.complex)
		{
			if(b.complex)
			{
				var q = b.re*b.re + b.im*b.im;
				return math.complex((a.re*b.re + a.im*b.im)/q, (a.im*b.re - a.re*b.im)/q);
			}
			else
				return math.complex(a.re/b, a.im/b);
		}
		else
		{
			if(b.complex)
			{
				var q = b.re*b.re + b.im*b.im;
				return math.complex(a*b.re/q, -a*b.im/q);
			}
			else
				return a/b;
		}
	},

	/** Exponentiate a number
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 */
	pow: function(a,b)
	{
		if(a.complex && Numbas.util.isInt(b) && Math.abs(b)<100)
		{
			if(b<0)
				return math.div(1,math.pow(a,-b));
			if(b==0)
				return 1;
			var coeffs = math.binomialCoefficients(b);

			var re = 0;
			var im = 0;
			var sign = 1;
			for(var i=0;i<b;i+=2) {
				re += coeffs[i]*Math.pow(a.re,b-i)*Math.pow(a.im,i)*sign;
				im += coeffs[i+1]*Math.pow(a.re,b-i-1)*Math.pow(a.im,i+1)*sign;
				sign = -sign;
			}
			if(b%2==0)
				re += Math.pow(a.im,b)*sign;
			return math.complex(re,im);
		}
		if(a.complex || b.complex || (a<0 && math.fract(b)!=0))
		{
			if(!a.complex)
				a = {re: a, im: 0, complex: true};
			if(!b.complex)
				b = {re: b, im: 0, complex: true};
			var ss = a.re*a.re + a.im*a.im;
			var arg1 = math.arg(a);
			var mag = Math.pow(ss,b.re/2) * Math.exp(-b.im*arg1);
			var arg = b.re*arg1 + (b.im * Math.log(ss))/2;
			return math.complex(mag*Math.cos(arg), mag*Math.sin(arg));
		}
		else
		{
			return Math.pow(a,b);
		}
	},

	/** Calculate the Nth row of Pascal's triangle
	 * @param {number} n
	 * @returns {number[]}
	 */
	binomialCoefficients: function(n) {
		var b = [1];
		var f = 1;

		for(var i=1;i<=n;i++) { 
			b.push( f*=(n+1-i)/i );
		}
		return b;
	},

	/** a mod b. Always returns a positive number
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 */
	mod: function(a,b) {
		if(b==Infinity) {
			return a;
		}
		b = math.abs(b);
		return ((a%b)+b)%b;
	},

	/** Calculate the `b`-th root of `a`
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 */
	root: function(a,b)
	{
		return math.pow(a,div(1,b));
	},

	/** Square root
	 * @param {number} n
	 * @returns {number}
	 */
	sqrt: function(n)
	{
		if(n.complex)
		{
			var r = math.abs(n);
			return math.complex( Math.sqrt((r+n.re)/2), (n.im<0 ? -1 : 1) * Math.sqrt((r-n.re)/2));
		}
		else if(n<0)
			return math.complex(0,Math.sqrt(-n));
		else
			return Math.sqrt(n)
	},

	/** Natural logarithm (base `e`)
	 * @param {number} n
	 * @returns {number}
	 */
	log: function(n)
	{
		if(n.complex)
		{
			var mag = math.abs(n);
			var arg = math.arg(n);
			return math.complex(Math.log(mag), arg);
		}
		else if(n<0)
			return math.complex(Math.log(-n),Math.PI);
		else
			return Math.log(n);
	},

	/** Calculate `e^n`
	 * @param {number} n
	 * @returns {number}
	 */
	exp: function(n)
	{
		if(n.complex)
		{
			return math.complex( Math.exp(n.re) * Math.cos(n.im), Math.exp(n.re) * Math.sin(n.im) );
		}
		else
			return Math.exp(n);
	},
	
	/** Magnitude of a number - absolute value of a real; modulus of a complex number.
	 * @param {number} n
	 * @returns {number}
	 */
	abs: function(n)
	{
		if(n.complex)
		{
			if(n.re==0)
				return Math.abs(n.im);
			else if(n.im==0)
				return Math.abs(n.re);
			else
				return Math.sqrt(n.re*n.re + n.im*n.im)
		}
		else
			return Math.abs(n);
	},

	/** Argument of a (complex) number
	 * @param {number} n
	 * @returns {number}
	 */
	arg: function(n)
	{
		if(n.complex)
			return Math.atan2(n.im,n.re);
		else
			return Math.atan2(0,n);
	},

	/** Real part of a number
	 * @param {number} n
	 * @returns {number}
	 */
	re: function(n)
	{
		if(n.complex)
			return n.re;
		else
			return n;
	},

	/** Imaginary part of a number
	 * @param {number} n
	 * @returns {number}
	 */
	im: function(n)
	{
		if(n.complex)
			return n.im;
		else
			return 0;
	},

	/** Is `a` less than `b`?
	 * @throws {Numbas.Error} `math.order complex numbers` if `a` or `b` are complex numbers.
	 * @param {number} a
	 * @param {number} b
	 * @returns {boolean}
	 */
	lt: function(a,b)
	{
		if(a.complex || b.complex)
			throw(new Numbas.Error('math.order complex numbers'));
		return a<b;
	},

	/** Is `a` greater than `b`?
	 * @throws {Numbas.Error} `math.order complex numbers` if `a` or `b` are complex numbers.
	 * @param {number} a
	 * @param {number} b
	 * @returns {boolean}
	 */
	gt: function(a,b)
	{
		if(a.complex || b.complex)
			throw(new Numbas.Error('math.order complex numbers'));
		return a>b;
	},

	/** Is `a` less than or equal to `b`?
	 * @throws {Numbas.Error} `math.order complex numbers` if `a` or `b` are complex numbers.
	 * @param {number} a
	 * @param {number} b
	 * @returns {boolean}
	 */
	leq: function(a,b)
	{
		if(a.complex || b.complex)
			throw(new Numbas.Error('math.order complex numbers'));
		return a<=b;
	},
	
	/** Is `a` greater than or equal to `b`?
	 * @throws {Numbas.Error} `math.order complex numbers` if `a` or `b` are complex numbers.
	 * @param {number} a
	 * @param {number} b
	 * @returns {boolean}
	 */
	geq: function(a,b)
	{
		if(a.complex || b.complex)
			throw(new Numbas.Error('math.order complex numbers'));
		return a>=b;
	},

	/** Is `a` equal to `b`?
	 * @param {number} a
	 * @param {number} b
	 * @returns {boolean}
	 */
	eq: function(a,b)
	{
		if(a.complex)
		{
			if(b.complex)
				return (a.re==b.re && a.im==b.im);
			else
				return (a.re==b && a.im==0);
		}
		else
		{
			if(b.complex)
				return (a==b.re && b.im==0);
			else
				return a==b;
		}
	},

	/** Greatest of two numbers - wraps `Math.max`
	 * @throws {Numbas.Error} `math.order complex numbers` if `a` or `b` are complex numbers.
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 */
	max: function(a,b)
	{
		if(a.complex || b.complex)
			throw(new Numbas.Error('math.order complex numbers'));
		return Math.max(a,b);
	},

	/** Greatest of a list of numbers
	 * @throws {Numbas.Error} `math.order complex numbers` if any element of the list is complex.
	 * @param {Array} numbers
	 * @returns {number}
	 */
	listmax: function(numbers) {
		if(numbers.length==0) {
			return;
		}
		var best = numbers[0];
		for(var i=1;i<numbers.length;i++) {
			best = math.max(best,numbers[i]);
		}
		return best;
	},

	/** Least of two numbers - wraps `Math.min`
	 * @throws {Numbas.Error} `math.order complex numbers` if `a` or `b` are complex numbers.
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 */
	min: function(a,b)
	{
		if(a.complex || b.complex)
			throw(new Numbas.Error('math.order complex numbers'));
		return Math.min(a,b);
	},
	
	/** Least of a list of numbers
	 * @throws {Numbas.Error} `math.order complex numbers` if any element of the list is complex.
	 * @param {Array} numbers
	 * @returns {number}
	 */
	listmin: function(numbers) {
		if(numbers.length==0) {
			return;
		}
		var best = numbers[0];
		for(var i=1;i<numbers.length;i++) {
			best = math.min(best,numbers[i]);
		}
		return best;
	},

	/** Are `a` and `b` unequal?
	 * @param {number} a
	 * @param {number} b
	 * @returns {boolean}
	 * @see Numbas.math.eq
	 */
	neq: function(a,b)
	{
		return !math.eq(a,b);
	},

	/** If `n` can be written in the form `a*pi^n`, return the biggest possible `n`, otherwise return `0`.
	 * @param {number} n
	 * @returns {number}
	 */
	piDegree: function(n)
	{
		n=Math.abs(n);

		if(n>10000)	//so big numbers don't get rounded to a power of pi accidentally
			return 0;

		var degree,a;
		for(degree=1; (a=n/Math.pow(Math.PI,degree))>1 && Math.abs(a-math.round(a))>0.00000001; degree++) {}
		return( a>=1 ? degree : 0 );
	},

	/** Display a number nicely - rounds off to 10dp so floating point errors aren't displayed
	 * @param {number} n
	 * @param {object} options - `precisionType` is either "dp" or "sigfig"
	 * @returns {string}
	 */
	niceNumber: function(n,options)
	{
		options = options || {};
		if(n.complex)
		{
			var re = math.niceNumber(n.re,options);
			var im = math.niceNumber(n.im,options);
			if(math.precround(n.im,10)==0)
				return re+'';
			else if(math.precround(n.re,10)==0)
			{
				if(n.im==1)
					return 'i';
				else if(n.im==-1)
					return '-i';
				else
					return im+'*i';
			}
			else if(n.im<0)
			{
				if(n.im==-1)
					return re+' - i';
				else
					return re+im+'*i';
			}
			else
			{
				if(n.im==1)
					return re+' + '+'i';
				else
					return re+' + '+im+'*i';
			}
		}
		else	
		{
			if(n==Infinity) {
				return 'infinity';
			} else if(n==-Infinity) {
				return '-infinity';
			}

			var piD;
			if((piD = math.piDegree(n)) > 0)
				n /= Math.pow(Math.PI,piD);

			var out;
			switch(options.precisionType) {
			case 'sigfig':
				var precision = options.precision;
				out = math.siground(n,precision)+'';
				var sigFigs = math.countSigFigs(out,true);
				if(sigFigs<precision) {
					if(out.indexOf('.')==-1)
						out += '.';
					for(var i=0;i<precision-sigFigs;i++)
						out+='0';
				}
				break;
			case 'dp':
				var precision = options.precision;
				out = math.precround(n,precision)+'';
				var dp = math.countDP(out);
				if(dp<precision) {
					if(out.indexOf('.')==-1)
						out += '.';
					for(var i=0;i<precision-dp;i++)
						out+='0';
				}
				break;
			default:
				var a = Math.abs(n);
				if(a<1e-15) {
					out = '0';
				} else if(Math.abs(n)<1e-8) {
					out = n+'';
				} else {
					out = math.precround(n,10)+'';
				}
			}
			switch(piD)
			{
			case 0:
				return out;
			case 1:
				if(n==1)
					return 'pi';
				else if(n==-1)
					return '-pi';
				else
					return out+'*pi';
			default:
				if(n==1)
					return 'pi^'+piD;
				else if(n==-1)
					return '-pi^'+piD;
				else
					return out+'*pi'+piD;
			}
		}
	},

	/** Get a random number in range `[0..n-1]`
	 * @param {number} n
	 * @returns {number}
	 */
	randomint: function(n) {
		return Math.floor(n*(Math.random()%1)); 
	},

	/** Get a  random shuffling of the numbers `[0..n-1]`
	 * @param {number} n
	 * @returns {number[]}
	 */
	deal: function(N) 
	{ 
		var J, K, Q = new Array(N);
		for (J=0 ; J<N ; J++)
			{ K = math.randomint(J+1) ; Q[J] = Q[K] ; Q[K] = J; }
		return Q; 
	},

	/** Randomly shuffle a list. Returns a new list - the original is unmodified.
	 * @param {Array} list
	 * @returns {Array}
	 */
	shuffle: function(list) {
		var l = list.length;
		var permutation = math.deal(l);
		var list2 = new Array(l);
		for(var i=0;i<l;i++) {
			list2[i]=(list[permutation[i]]);
		}
		return list2;
	},

	/** Calculate the inverse of a shuffling
	 * @param {number[]} l
	 * @returns {number[]} l
	 * @see Numbas.math.deal
	 */
	inverse: function(l)
	{
		arr = new Array(l.length);
		for(var i=0;i<l.length;i++)
		{
			arr[l[i]]=i;
		}
		return arr;
	},

	/* Just the numbers from 1 to `n` (inclusive) in an array!
	 * @param {number} n
	 * @returns {number[]}
	 */
	range: function(n)
	{
		var arr=new Array(n);
		for(var i=0;i<n;i++)
		{
			arr[i]=i;
		}
		return arr;
	},

	/** Round `a` to `b` decimal places. Real and imaginary parts of complex numbers are rounded independently.
	 * @param {number} n
	 * @param {number} b
	 * @returns {number}
	 * @throws {Numbas.Error} "math.precround.complex" if b is complex
	 */
	precround: function(a,b) {
		if(b.complex)
			throw(new Numbas.Error('math.precround.complex'));
		if(a.complex)
			return math.complex(math.precround(a.re,b),math.precround(a.im,b));
		else
		{
			var be = Math.pow(10,b);

			var fracPart = a % 1;
			var intPart = a - fracPart;

			//test to allow a bit of leeway to account for floating point errors
			//if a*10^b is less than 1e-9 away from having a five as the last digit of its whole part, round it up anyway
			var v = fracPart*be*10 % 1;
			var d = (fracPart>0 ? Math.floor : Math.ceil)(fracPart*be*10 % 10);
			fracPart *= be;
			if( (d==4 && 1-v<1e-9) || (d==-5 && v>-1e-9 && v<0)) {
				fracPart += 1;
			}
			fracPart = Math.abs(Math.round(fracPart));
			if(fracPart==be) {
				return intPart+math.sign(fracPart);
			}
			var fracPartString = Math.round(fracPart)+'';
			while(fracPartString.length<b) {
				fracPartString = '0'+fracPartString;
			}
			var out = parseFloat(intPart+'.'+fracPartString);
			if(intPart==0 && a<0) {
				return -out;
			} else {
				return out;
			}
		}
	},

	/** Round `a` to `b` significant figures. Real and imaginary parts of complex numbers are rounded independently.
	 * @param {number} n
	 * @param {number} b
	 * @returns {number}
	 * @throws {Numbas.Error} "math.precround.complex" if b is complex
	 */
	siground: function(a,b) {
		if(b.complex)
			throw(new Numbas.Error('math.siground.complex'));
		if(a.complex)
			return math.complex(math.siground(a.re,b),math.siground(a.im,b));
		else
		{
			var s = math.sign(a);
			if(a==0) { return 0; }
			if(a==Infinity || a==-Infinity) { return a; }
			b = Math.pow(10, b-Math.ceil(math.log10(s*a)));

			//test to allow a bit of leeway to account for floating point errors
			//if a*10^b is less than 1e-9 away from having a five as the last digit of its whole part, round it up anyway
			var v = a*b*10 % 1;
			var d = (a>0 ? Math.floor : Math.ceil)(a*b*10 % 10);
			if(d==4 && 1-v<1e-9) {
				return Math.round(a*b+1)/b;
			}
			else if(d==-5 && v>-1e-9 && v<0) {
				return Math.round(a*b+1)/b;
			}

			return Math.round(a*b)/b;
		}
	},

	/** Count the number of decimal places used in the string representation of a number.
	 * @param {number|string} n
	 * @returns {number}
	 */
	countDP: function(n) {
		var m = n.match(/\.(\d*)$/);
		if(!m)
			return 0;
		else
			return m[1].length;
	},
	
	/** Calculate the significant figures precision of a number.
	 * @param {number|string} n
	 * @param {number} [max] - be generous with calculating sig. figs. for whole numbers. e.g. '1000' could be written to 4 sig figs.
	 * @returns {number}
	 */
	countSigFigs: function(n,max) {
		var m;
		if(max) {
			m = n.match(/^-?(?:(\d0*)$|(?:([1-9]\d*[1-9]0*)$)|([1-9]\d*\.\d+$)|(0\.0+$)|(?:0\.0*([1-9]\d*))$)/);
		} else {
			m = n.match(/^-?(?:(\d)0*$|(?:([1-9]\d*[1-9])0*$)|([1-9]\d*\.\d+$)|(0\.0+$)|(?:0\.0*([1-9]\d*))$)/);
		}
		if(!m)
			return 0;
		var sigFigs = m[1] || m[2] || m[3] || m[4] || m[5];
		return sigFigs.replace('.','').length;
	},

	/** Is n given to the desired precision?
	 * @param {number|string} n
	 * @param {string} precisionType - either 'dp' or 'sigfig'
	 * @param {number} precision - number of desired digits of precision
	 * @param {boolean} strictPrecision - must trailing zeroes be used to get to the desired precision (true), or is it allowed to give fewer digits in that case (false)?
	 * @returns {boolean}
	 */
	toGivenPrecision: function(n,precisionType,precision,strictPrecision) {
		if(precisionType=='none') {
			return true;
		}

		n += '';

		var precisionOK = false;

		var counters = {'dp': math.countDP, 'sigfig': math.countSigFigs};
		var counter = counters[precisionType];
		var digits = counter(n);

		if(strictPrecision)
			precisionOK = digits == precision;
		else
			precisionOK = digits <= precision;

		if(precisionType=='sigfig' && !precisionOK && digits < precision && /[1-9]\d*0+$/.test(n)) {	// in cases like 2070, which could be to either 3 or 4 sig figs
			var trailingZeroes = n.match(/0*$/)[0].length;
			if(sigFigs + trailingZeroes >= precision) {
				precisionOK = true;
			}
		}

		return precisionOK;
	},

	/** Is a within +/- tolerance of b?
	 * @param {number} a
	 * @param {number} b
	 * @param {number} tolerance
	 * @returns {boolean}
	 */
	withinTolerance: function(a,b,tolerance) {
		if(tolerance==0) {
			return math.eq(a,b);
		} else {
			var upper = math.add(b,tolerance);
			var lower = math.sub(b,tolerance);
			return math.geq(a,lower) && math.leq(a,upper);
		}
	},

	/** Factorial, or Gamma(n+1) if n is not a positive integer.
	 * @param {number} n
	 * @returns {number}
	 */
	factorial: function(n)
	{
		if( Numbas.util.isInt(n) && n>=0 )
		{
			if(n<=1) {
				return 1;
			}else{
				var j=1;
				for(var i=2;i<=n;i++)
				{
					j*=i;
				}
				return j;
			}
		}
		else	//gamma function extends factorial to non-ints and negative numbers
		{
			return math.gamma(math.add(n,1));
		}
	},

	/** Lanczos approximation to the gamma function 
	 *
	 * http://en.wikipedia.org/wiki/Lanczos_approximation#Simple_implementation
	 * @param {number} n
	 * @returns {number}
	 */
	gamma: function(n)
	{
		var g = 7;
		var p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
		
		var mul = math.mul, div = math.div, exp = math.exp, neg = math.negate, pow = math.pow, sqrt = math.sqrt, sin = math.sin, add = math.add, sub = math.sub, pi = Math.PI, im = math.complex(0,1);
		
		if((n.complex && n.re<0.5) || (!n.complex && n<0.5))
		{
			return div(pi,mul(sin(mul(pi,n)),math.gamma(sub(1,n))));
		}
		else
		{
			n = sub(n,1);			//n -= 1
			var x = p[0];
			for(var i=1;i<g+2;i++)
			{
				x = add(x, div(p[i],add(n,i)));	// x += p[i]/(n+i)
			}
			var t = add(n,add(g,0.5));		// t = n+g+0.5
			return mul(sqrt(2*pi),mul(pow(t,add(n,0.5)),mul(exp(neg(t)),x)));	// return sqrt(2*pi)*t^(z+0.5)*exp(-t)*x
		}
	},

	/** Base-10 logarithm
	 * @param {number} n
	 * @returns {number}
	 */
	log10: function(n)
	{
		return mul(math.log(n),Math.LOG10E);
	},

	/** Convert from degrees to radians
	 * @param {number} x
	 * @returns {number}
	 * @see Numbas.math.degrees
	 */
	radians: function(x) {
		return mul(x,Math.PI/180);
	},

	/** Convert from radians to degrees
	 * @param {number} x
	 * @returns {number}
	 * @see Numbas.math.radians
	 */
	degrees: function(x) {
		return mul(x,180/Math.PI);
	},

	/** Cosine
	 * @param {number} x
	 * @returns {number}
	 */
	cos: function(x) {
		if(x.complex)
		{
			return math.complex(Math.cos(x.re)*math.cosh(x.im), -Math.sin(x.re)*math.sinh(x.im));
		}
		else
			return Math.cos(x);
	},
	
	/** Sine
	 * @param {number} x
	 * @returns {number}
	 */
	sin: function(x) {
		if(x.complex)
		{
			return math.complex(Math.sin(x.re)*math.cosh(x.im), Math.cos(x.re)*math.sinh(x.im));
		}
		else
			return Math.sin(x);
	},

	/** Tangent
	 * @param {number} x
	 * @returns {number}
	 */
	tan: function(x) {
		if(x.complex)
			return div(math.sin(x),math.cos(x));
		else
			return Math.tan(x);
	},

	/** Cosecant 
	 * @param {number} x
	 * @returns {number}
	 */
	cosec: function(x) {
		return div(1,math.sin(x));
	},

	/** Secant
	 * @param {number} x
	 * @returns {number}
	 */
	sec: function(x) {
		return div(1,math.cos(x));
	},
		
	/** Cotangent
	 * @param {number} x
	 * @returns {number}
	 */
	cot: function(x) {
		return div(1,math.tan(x));
	},

	/** Inverse sine
	 * @param {number} x
	 * @returns {number}
	 */
	arcsin: function(x) {
		if(x.complex || math.abs(x)>1)
		{
			var i = math.complex(0,1), ni = math.complex(0,-1);
			var ex = add(mul(x,i),math.sqrt(sub(1,mul(x,x)))); //ix+sqrt(1-x^2)
			return mul(ni,math.log(ex));
		}
		else
			return Math.asin(x);
	},

	/** Inverse cosine
	 * @param {number} x
	 * @returns {number}
	 */
	arccos: function(x) {
		if(x.complex || math.abs(x)>1)
		{
			var i = math.complex(0,1), ni = math.complex(0,-1);
			var ex = add(x, math.sqrt( sub(mul(x,x),1) ) );	//x+sqrt(x^2-1)
			var result = mul(ni,math.log(ex));
			if(math.re(result)<0 || math.re(result)==0 && math.im(result)<0)
				result = math.negate(result);
			return result;
		}
		else
			return Math.acos(x);
	},

	/** Inverse tangent
	 * @param {number} x
	 * @returns {number}
	 */
	arctan: function(x) {
		if(x.complex)
		{
			var i = math.complex(0,1);
			var ex = div(add(i,x),sub(i,x));
			return mul(math.complex(0,0.5), math.log(ex));
		}
		else
			return Math.atan(x);
	},

	/** Hyperbolic sine
	 * @param {number} x
	 * @returns {number}
	 */
	sinh: function(x) {
		if(x.complex)
			return div(sub(math.exp(x), math.exp(math.negate(x))),2);
		else
			return (Math.exp(x)-Math.exp(-x))/2;
	},

	/** Hyperbolic cosine
	 * @param {number} x
	 * @returns {number}
	 */
	cosh: function(x) {
		if(x.complex)
			return div(add(math.exp(x), math.exp(math.negate(x))),2);
		else
			return (Math.exp(x)+Math.exp(-x))/2
	},

	/** Hyperbolic tangent
	 * @param {number} x
	 * @returns {number}
	 */
	tanh: function(x) {
		return div(math.sinh(x),math.cosh(x));
	},

	/** Hyperbolic cosecant
	 * @param {number} x
	 * @returns {number}
	 */
	cosech: function(x) {
		return div(1,math.sinh(x));
	},

	/** Hyperbolic secant
	 * @param {number} x
	 * @returns {number}
	 */
	sech: function(x) {
		return div(1,math.cosh(x));
	},

	/** Hyperbolic tangent
	 * @param {number} x
	 * @returns {number}
	 */
	coth: function(x) {
		return div(1,math.tanh(x));
	},

	/** Inverse hyperbolic sine
	 * @param {number} x
	 * @returns {number}
	 */
	arcsinh: function(x) {
		if(x.complex)
			return math.log(add(x, math.sqrt(add(mul(x,x),1))));
		else
			return Math.log(x + Math.sqrt(x*x+1));
	},

	/** Inverse hyperbolic cosine
	 * @param {number} x
	 * @returns {number}
	 */
	arccosh: function (x) {
		if(x.complex)
			return math.log(add(x, math.sqrt(sub(mul(x,x),1))));
		else
			return Math.log(x + Math.sqrt(x*x-1));
	},

	/** Inverse hyperbolic tangent
	 * @param {number} x
	 * @returns {number}
	 */
	arctanh: function (x) {
		if(x.complex)
			return div(math.log(div(add(1,x),sub(1,x))),2);
		else
			return 0.5 * Math.log((1+x)/(1-x));
	},

	/** Round up to the nearest integer. For complex numbers, real and imaginary parts are rounded independently.
	 * @param {number} x
	 * @returns {number}
	 * @see Numbas.math.round
	 * @see Numbas.math.floor
	 */
	ceil: function(x) {
		if(x.complex)
			return math.complex(math.ceil(x.re),math.ceil(x.im));
		else
			return Math.ceil(x);
	},

	/** Round down to the nearest integer. For complex numbers, real and imaginary parts are rounded independently.
	 * @param {number} x
	 * @returns {number}
	 * @see Numbas.math.ceil
	 * @see Numbas.math.round
	 */
	floor: function(x) {
		if(x.complex)
			return math.complex(math.floor(x.re),math.floor(x.im));
		else
			return Math.floor(x);
	},

	/** Round to the nearest integer; fractional part >= 0.5 rounds up. For complex numbers, real and imaginary parts are rounded independently.
	 * @param {number} x
	 * @returns {number}
	 * @see Numbas.math.ceil
	 * @see Numbas.math.floor
	 */
	round: function(x) {
		if(x.complex)
			return math.complex(Math.round(x.re),Math.round(x.im));
		else
			return Math.round(x);
	},

	/** Integer part of a number - chop off the fractional part. For complex numbers, real and imaginary parts are rounded independently.
	 * @param {number} x
	 * @returns {number}
	 * @see Numbas.math.fract
	 */
	trunc: function(x) {
		if(x.complex)
			return math.complex(math.trunc(x.re),math.trunc(x.im));

		if(x>0) {
			return Math.floor(x);
		}else{
			return Math.ceil(x);
		}
	},

	/** Fractional part of a number - Take away the whole number part. For complex numbers, real and imaginary parts are rounded independently.
	 * @param {number} x
	 * @returns {number}
	 * @see Numbas.math.trunc
	 */
	fract: function(x) {
		if(x.complex)
			return math.complex(math.fract(x.re),math.fract(x.im));

		return x-math.trunc(x);
	},

	/** Sign of a number - +1, 0, or -1. For complex numbers, gives the sign of the real and imaginary parts separately.
	 * @param {number} x
	 * @returns {number}
	 */
	sign: function(x) {
		if(x.complex)
			return math.complex(math.sign(x.re),math.sign(x.im));

		if(x==0) {
			return 0;
		}else if (x>0) {
			return 1;
		}else {
			return -1;
		}
	},

	/** Get a random real number between `min` and `max` (inclusive)
	 * @param {number} min
	 * @param {number] max
	 * @returns {number}
	 * @see Numbas.math.random
	 * @see Numbas.math.choose
	 */
	randomrange: function(min,max)
	{
		return Math.random()*(max-min)+min;
	},

	/** Get a random number in the specified range. 
	 *
	 * Returns a random choice from `min` to `max` at `step`-sized intervals
	 *
	 * If all the values in the range are appended to the list, eg `[min,max,step,v1,v2,v3,...]`, just pick randomly from the values.
	 * 
	 * @param {range} range - `[min,max,step]`
	 * @returns {number}
	 * @see Numbas.math.randomrange
	 */
	random: function(range)
	{
		if(range.length>3)	//if values in range are given after [min,max,step]
		{
			return math.choose(range.slice(3));
		}
		else
		{
			if(range[2]==0)
			{
				return math.randomrange(range[0],range[1]);
			}
			else
			{
				var diff = range[1]-range[0];
				var steps = diff/range[2];
				var n = Math.floor(math.randomrange(0,steps+1));
				return range[0]+n*range[2];
			}
		}
	},

	/** Remove all the values in the list `exclude` from the list `range`
	 * @param {number[]} range
	 * @param {number[]} exclude
	 * @returns {number[]}
	 */
	except: function(range,exclude) {
		range = range.filter(function(r) {
			for(var i=0;i<exclude.length;i++) {
				if(math.eq(r,exclude[i]))
					return false;
			}
			return true;
		});
		return range;
	},

	/** Choose one item from an array, at random
	 * @param {Array} selection
	 * @returns {object}
	 * @throws {Numbas.Error} "math.choose.empty selection" if `selection` has length 0.
	 * @see Numbas.math.randomrange
	 */
	choose: function(selection)
	{
		if(selection.length==0)
			throw(new Numbas.Error('math.choose.empty selection'));
		var n = Math.floor(math.randomrange(0,selection.length));
		return selection[n];
	},


	/* Product of the numbers in the range `[a..b]`, i.e. $frac{a!}{b!}$.
	 *
	 * from http://dreaminginjavascript.wordpress.com/2008/11/08/combinations-and-permutations-in-javascript/ 
	 * 
	 * (public domain)
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 */
	productRange: function(a,b) {
		if(a>b)
			return 1;
		var product=a,i=a;
		while (i++<b) {
			product*=i;
		}
		return product;
	},
	 
	/** `nCk` - number of ways of picking `k` unordered elements from `n`.
	 * @param {number} n
	 * @param {number} k
	 * @throws {Numbas.Error} "math.combinations.complex" if either of `n` or `k` is complex.
	 */
	combinations: function(n,k) {
		if(n.complex || k.complex)
			throw(new Numbas.Error('math.combinations.complex'));

		k=Math.max(k,n-k);
		return math.productRange(k+1,n)/math.productRange(1,n-k);
	},

	/** `nPk` - number of ways of picking `k` ordered elements from `n`.
	 * @param {number} n
	 * @param {number} k
	 * @throws {Numbas.Error} "math.combinations.complex" if either of `n` or `k` is complex.
	 */
	permutations: function(n,k) {
		if(n.complex || k.complex)
			throw(new Numbas.Error('math.permutations.complex'));

		return math.productRange(k+1,n);
	},

	/** Does `a` divide `b`? If either of `a` or `b` is not an integer, return `false`.
	 * @param {number} a
	 * @param {number} b
	 * @returns {boolean}
	 */
	divides: function(a,b) {
		if(a.complex || b.complex || !Numbas.util.isInt(a) || !Numbas.util.isInt(b))
			return false;

		return (b % a) == 0;
	},

	/** Greatest common factor (GCF), or greatest common divisor (GCD), of `a` and `b`.
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 * @throws {Numbas.Error} "math.gcf.complex" if either of `a` or `b` is complex.
	 */
	gcd: function(a,b) {
		if(a.complex || b.complex)
			throw(new Numbas.Error('math.gcf.complex'));

		if(Math.floor(a)!=a || Math.floor(b)!=b)
			return 1;
		a = Math.floor(Math.abs(a));
		b = Math.floor(Math.abs(b));
		
		var c=0;
		if(a<b) { c=a; a=b; b=c; }		

		if(b==0){return 1;}
		
		while(a % b != 0) {
			c=b;
			b=a % b;
			a=c;
		}
		return b;
	},

	/** Lowest common multiple (LCM) of `a` and `b`.
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 * @throws {Numbas.Error} "math.gcf.complex" if either of `a` or `b` is complex.
	 */
	lcm: function(a,b) {
		if(arguments.length==0) {
			return 1;
		} else if(arguments.length==1) {
			return a;
		}
		if(a.complex || b.complex)
			throw(new Numbas.Error('math.lcm.complex'));

		if(arguments.length>2) {
			a = Math.floor(Math.abs(a));
			for(var i=1;i<arguments.length;i++) {
				if(arguments[i].complex) {
					throw(new Numbas.Error('math.lcm.complex'));
				}
				b = Math.floor(Math.abs(arguments[i]));
				a = a*b/math.gcf(a,b);
			}
			return a;
		}

		a = Math.floor(Math.abs(a));
		b = Math.floor(Math.abs(b));
		
		var c = math.gcf(a,b);
		return a*b/c;
	},


	/** Write the range of integers `[a..b]` as an array of the form `[min,max,step]`, for use with {@link Numbas.math.random}. If either number is complex, only the real part is used.
	 *
	 * @param {number} a
	 * @param {number} b
	 * @returns {range}
	 * @see Numbas.math.random
	 */
	defineRange: function(a,b)
	{
		if(a.complex)
			a=a.re;
		if(b.complex)
			b=b.re;
		return [a,b,1];
	},

	/** Change the step size of a range created with {@link Numbas.math.defineRange}
	 * @param {range} range
	 * @param {number} step
	 * @returns {range}
	 */
	rangeSteps: function(range,step)
	{
		if(step.complex)
			step = step.re;
		return [range[0],range[1],step];
	},

	/** Get a rational approximation to a real number by the continued fractions method.
	 *
	 * If `accuracy` is given, the returned answer will be within `Math.exp(-accuracy)` of the original number
	 * 
	 * @param {number} n
	 * @param {number} [accuracy]
	 * @returns {number[]} - [numerator,denominator]
	 */
	rationalApproximation: function(n,accuracy)
	{
		if(accuracy===undefined)
			accuracy = 15;
		accuracy = Math.exp(-accuracy);

		var on = n;
		var e = Math.floor(n);
		if(e==n)
			return [n,1];
		var l = 0;
		var frac = [];
		while(Math.abs(on-e)>accuracy)
		{
			l+=1;
			var i = Math.floor(n);
			frac.push(i);
			n = 1/(n-i);
			var e = Infinity;
			for(var j=l-1;j>=0;j--)
			{
				e = frac[j]+1/e;
			}
		}
		if(l==0) {
			return [e,1];
		}
		var f = [1,0];
		for(j=l-1;j>=0;j--)
		{
			f = [frac[j]*f[0]+f[1],f[0]];
		}
		return f;
	},

	/** The first 1000 primes */
	primes: [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127,131,137,139,149,151,157,163,167,173,179,181,191,193,197,199,211,223,227,229,233,239,241,251,257,263,269,271,277,281,283,293,307,311,313,317,331,337,347,349,353,359,367,373,379,383,389,397,401,409,419,421,431,433,439,443,449,457,461,463,467,479,487,491,499,503,509,521,523,541,547,557,563,569,571,577,587,593,599,601,607,613,617,619,631,641,643,647,653,659,661,673,677,683,691,701,709,719,727,733,739,743,751,757,761,769,773,787,797,809,811,821,823,827,829,839,853,857,859,863,877,881,883,887,907,911,919,929,937,941,947,953,967,971,977,983,991,997,1009,1013,1019,1021,1031,1033,1039,1049,1051,1061,1063,1069,1087,1091,1093,1097,1103,1109,1117,1123,1129,1151,1153,1163,1171,1181,1187,1193,1201,1213,1217,1223,1229,1231,1237,1249,1259,1277,1279,1283,1289,1291,1297,1301,1303,1307,1319,1321,1327,1361,1367,1373,1381,1399,1409,1423,1427,1429,1433,1439,1447,1451,1453,1459,1471,1481,1483,1487,1489,1493,1499,1511,1523,1531,1543,1549,1553,1559,1567,1571,1579,1583,1597,1601,1607,1609,1613,1619,1621,1627,1637,1657,1663,1667,1669,1693,1697,1699,1709,1721,1723,1733,1741,1747,1753,1759,1777,1783,1787,1789,1801,1811,1823,1831,1847,1861,1867,1871,1873,1877,1879,1889,1901,1907,1913,1931,1933,1949,1951,1973,1979,1987,1993,1997,1999,2003,2011,2017,2027,2029,2039,2053,2063,2069,2081,2083,2087,2089,2099,2111,2113,2129,2131,2137,2141,2143,2153,2161,2179,2203,2207,2213,2221,2237,2239,2243,2251,2267,2269,2273,2281,2287,2293,2297,2309,2311,2333,2339,2341,2347,2351,2357,2371,2377,2381,2383,2389,2393,2399,2411,2417,2423,2437,2441,2447,2459,2467,2473,2477,2503,2521,2531,2539,2543,2549,2551,2557,2579,2591,2593,2609,2617,2621,2633,2647,2657,2659,2663,2671,2677,2683,2687,2689,2693,2699,2707,2711,2713,2719,2729,2731,2741,2749,2753,2767,2777,2789,2791,2797,2801,2803,2819,2833,2837,2843,2851,2857,2861,2879,2887,2897,2903,2909,2917,2927,2939,2953,2957,2963,2969,2971,2999,3001,3011,3019,3023,3037,3041,3049,3061,3067,3079,3083,3089,3109,3119,3121,3137,3163,3167,3169,3181,3187,3191,3203,3209,3217,3221,3229,3251,3253,3257,3259,3271,3299,3301,3307,3313,3319,3323,3329,3331,3343,3347,3359,3361,3371,3373,3389,3391,3407,3413,3433,3449,3457,3461,3463,3467,3469,3491,3499,3511,3517,3527,3529,3533,3539,3541,3547,3557,3559,3571,3581,3583,3593,3607,3613,3617,3623,3631,3637,3643,3659,3671,3673,3677,3691,3697,3701,3709,3719,3727,3733,3739,3761,3767,3769,3779,3793,3797,3803,3821,3823,3833,3847,3851,3853,3863,3877,3881,3889,3907,3911,3917,3919,3923,3929,3931,3943,3947,3967,3989,4001,4003,4007,4013,4019,4021,4027,4049,4051,4057,4073,4079,4091,4093,4099,4111,4127,4129,4133,4139,4153,4157,4159,4177,4201,4211,4217,4219,4229,4231,4241,4243,4253,4259,4261,4271,4273,4283,4289,4297,4327,4337,4339,4349,4357,4363,4373,4391,4397,4409,4421,4423,4441,4447,4451,4457,4463,4481,4483,4493,4507,4513,4517,4519,4523,4547,4549,4561,4567,4583,4591,4597,4603,4621,4637,4639,4643,4649,4651,4657,4663,4673,4679,4691,4703,4721,4723,4729,4733,4751,4759,4783,4787,4789,4793,4799,4801,4813,4817,4831,4861,4871,4877,4889,4903,4909,4919,4931,4933,4937,4943,4951,4957,4967,4969,4973,4987,4993,4999,5003,5009,5011,5021,5023,5039,5051,5059,5077,5081,5087,5099,5101,5107,5113,5119,5147,5153,5167,5171,5179,5189,5197,5209,5227,5231,5233,5237,5261,5273,5279,5281,5297,5303,5309,5323,5333,5347,5351,5381,5387,5393,5399,5407,5413,5417,5419,5431,5437,5441,5443,5449,5471,5477,5479,5483,5501,5503,5507,5519,5521,5527,5531,5557,5563,5569,5573,5581,5591,5623,5639,5641,5647,5651,5653,5657,5659,5669,5683,5689,5693,5701,5711,5717,5737,5741,5743,5749,5779,5783,5791,5801,5807,5813,5821,5827,5839,5843,5849,5851,5857,5861,5867,5869,5879,5881,5897,5903,5923,5927,5939,5953,5981,5987,6007,6011,6029,6037,6043,6047,6053,6067,6073,6079,6089,6091,6101,6113,6121,6131,6133,6143,6151,6163,6173,6197,6199,6203,6211,6217,6221,6229,6247,6257,6263,6269,6271,6277,6287,6299,6301,6311,6317,6323,6329,6337,6343,6353,6359,6361,6367,6373,6379,6389,6397,6421,6427,6449,6451,6469,6473,6481,6491,6521,6529,6547,6551,6553,6563,6569,6571,6577,6581,6599,6607,6619,6637,6653,6659,6661,6673,6679,6689,6691,6701,6703,6709,6719,6733,6737,6761,6763,6779,6781,6791,6793,6803,6823,6827,6829,6833,6841,6857,6863,6869,6871,6883,6899,6907,6911,6917,6947,6949,6959,6961,6967,6971,6977,6983,6991,6997,7001,7013,7019,7027,7039,7043,7057,7069,7079,7103,7109,7121,7127,7129,7151,7159,7177,7187,7193,72077211,7213,7219,7229,7237,7243,7247,7253,7283,7297,7307,7309,7321,7331,7333,7349,7351,7369,7393,7411,7417,7433,7451,7457,7459,7477,7481,7487,7489,7499,7507,7517,7523,7529,7537,7541,7547,7549,7559,7561,7573,7577,7583,7589,7591,7603,7607,7621,7639,7643,7649,7669,7673,7681,7687,7691,7699,7703,7717,7723,7727,7741,7753,7757,7759,7789,7793,7817,7823,7829,7841,7853,7867,7873,7877,7879,7883,7901,7907,7919],

	/** Factorise n. When n=2^(a1)*3^(a2)*5^(a3)*..., this returns the powers [a1,a2,a3,...]
	 * 
	 * @param {number} n
	 * @returns {number[]} - exponents of the prime factors of n
	 */
	factorise: function(n) {
		if(n<=0) {
			return [];
		}
		var factors = [];
		for(var i=0;i<math.primes.length;i++) {
			var acc = 0;
			var p = math.primes[i];
			while(n%p==0) {
				acc += 1;
				n /= p;
			}
			factors.push(acc);
			if(n==1) {
				break;
			}
		}
		return factors;
	}

};
math.gcf = math.gcd;

var add = math.add, sub = math.sub, mul = math.mul, div = math.div, eq = math.eq, neq = math.neq, negate = math.negate;

/** A list of the vector's components. 
 * @typedef vector
 *  @type {number[]}
 */

/** Vector operations.
 *
 * These operations are very lax about the dimensions of vectors - they stick zeroes in when pairs of vectors don't line up exactly
 * @namespace Numbas.vectormath
 */
var vectormath = Numbas.vectormath = {
	/** Negate a vector - negate each of its components
	 * @param {vector} v
	 * @returns {vector}
	 */
	negate: function(v) {
		return v.map(function(x) { return negate(x); });
	},

	/** Add two vectors
	 * @param {vector} a
	 * @param {vector} b
	 * @returns {vector}
	 */
	add: function(a,b) {
		if(b.length>a.length)
		{
			var c = b;
			b = a;
			a = c;
		}
		return a.map(function(x,i){ return add(x,b[i]||0) });
	},

	/** Subtract one vector from another
	 * @param {vector} a
	 * @param {vector} b
	 * @returns {vector}
	 */
	sub: function(a,b) {
		if(b.length>a.length)
		{
			return b.map(function(x,i){ return sub(a[i]||0,x) });
		}
		else
		{
			return a.map(function(x,i){ return sub(x,b[i]||0) });
		}
	},

	/** Multiply by a scalar
	 * @param {number} k
	 * @param {vector} v
	 * @returns {vector}
	 */
	mul: function(k,v) {
		return v.map(function(x){ return mul(k,x) });
	},

	/** Divide by a scalar
	 * @param {vector} v
	 * @param {number} k
	 * @returns {vector}
	 */
	div: function(v,k) {
		return v.map(function(x){ return div(x,k); });
	},

	/** Vector dot product - each argument can be a vector, or a matrix with one row or one column, which is converted to a vector.
	 * @param {vector|matrix} a
	 * @param {vector|matrix} b
	 * @returns {number}
	 * @throws {NumbasError} "vectormaths.dot.matrix too big" if either of `a` or `b` is bigger than `1xN` or `Nx1`.
	 */
	dot: function(a,b) {

		//check if A is a matrix object. If it's the right shape, we can use it anyway
		if('rows' in a)
		{
			if(a.rows==1)
				a = a[0];
			else if(a.columns==1)
				a = a.map(function(x){return x[0]});
			else
				throw(new Numbas.Error('vectormath.dot.matrix too big'));
		}
		//Same check for B
		if('rows' in b)
		{
			if(b.rows==1)
				b = b[0];
			else if(b.columns==1)
				b = b.map(function(x){return x[0]});
			else
				throw(new Numbas.Error('vectormath.dot.matrix too big'));
		}
		if(b.length>a.length)
		{
			var c = b;
			b = a;
			a = c;
		}
		return a.reduce(function(s,x,i){ return add(s,mul(x,b[i]||0)) },0);
	},

	/** Vector cross product - each argument can be a vector, or a matrix with one row, which is converted to a vector.
	 *
	 * @param {vector|matrix} a
	 * @param {vector|matrix} b
	 * @returns {vector}
	 *
	 * @throws {NumbasError} "vectormaths.cross.matrix too big" if either of `a` or `b` is bigger than `1xN` or `Nx1`.
	 * @throws {NumbasError} "vectormath.cross.not 3d" if either of the vectors is not 3D.
	 */
	cross: function(a,b) {
		//check if A is a matrix object. If it's the right shape, we can use it anyway
		if('rows' in a)
		{
			if(a.rows==1)
				a = a[0];
			else if(a.columns==1)
				a = a.map(function(x){return x[0]});
			else
				throw(new Numbas.Error('vectormath.cross.matrix too big'));
		}
		//Same check for B
		if('rows' in b)
		{
			if(b.rows==1)
				b = b[0];
			else if(b.columns==1)
				b = b.map(function(x){return x[0]});
			else
				throw(new Numbas.Error('vectormath.cross.matrix too big'));
		}

		if(a.length!=3 || b.length!=3)
			throw(new Numbas.Error('vectormath.cross.not 3d'));

		return [
				sub( mul(a[1],b[2]), mul(a[2],b[1]) ),
				sub( mul(a[2],b[0]), mul(a[0],b[2]) ),
				sub( mul(a[0],b[1]), mul(a[1],b[0]) )
				];
	},

	/** Length of a vector
	 * @param {vector} a
	 * @returns {number}
	 */
	abs: function(a) {
		return Math.sqrt( a.reduce(function(s,x){ return s + mul(x,x); },0) );
	},

	/** Are two vectors equal? True if each pair of corresponding components is equal.
	 * @param {vector} a
	 * @param {vector} b
	 * @returns {boolean}
	 */
	eq: function(a,b) {
		if(b.length>a.length)
		{
			var c = b;
			b = a;
			a = c;
		}
		return a.reduce(function(s,x,i){return s && eq(x,b[i]||0)},true);
	},

	/** Are two vectors unequal?
	 * @param {vector} a
	 * @param {vector} b
	 * @returns {boolean}
	 * @see {Numbas.vectormath.eq}
	 */
	neq: function(a,b) {
		return !vectormath.eq(a,b);
	},

	/** Multiply a vector on the left by a matrix
	 * @param {matrix} m
	 * @param {vector} v
	 * @returns {vector}
	 */
	matrixmul: function(m,v) {
		return m.map(function(row){
			return row.reduce(function(s,x,i){ return add(s,mul(x,v[i]||0)); },0);
		});
	},

	/** Transpose of a vector
	 * @param {vector} v
	 * @returns {matrix}
	 */
	transpose: function(v) {
		var matrix = v.map(function(x){ return [x]; });
		matrix.rows = 1;
		matrix.columns = v.length;
		return matrix;
	},

	/** Convert a vector to a 1-column matrix
	 * @param {vector} v
	 * @returns {matrix}
	 */
	toMatrix: function(v) {
		var m = v.map(function(n){return [n]});
		m.rows = m.length;
		m.columns = 1;
		return m;
	}
}

/** An array of rows (each of which is an array of numbers) 
 * @typedef matrix
 * @type {Array.Array.<number>}
 * @property {number} rows
 * @property {number} columns
 */

/** Matrix operations.
 *
 * These operations are very lax about the dimensions of vectors - they stick zeroes in when pairs of matrices don't line up exactly
 * @namespace Numbas.matrixmath
 */
var matrixmath = Numbas.matrixmath = {
	/** Negate a matrix - negate each of its elements */
	negate: function(m) {
		var matrix = [];
		for(var i=0;i<m.rows;i++) {
			matrix.push(m[i].map(function(x){ return negate(x) }));
		}
		matrix.rows = m.rows;
		matrix.columns = m.columns;
		return matrix;
	},

	/** Add two matrices.
	 *
	 * @param {matrix} a
	 * @param {matrix} b
	 * @returns {matrix}
	 */
	add: function(a,b) {
		var rows = Math.max(a.rows,b.rows);
		var columns = Math.max(a.columns,b.columns);
		var matrix = [];
		for(var i=0;i<rows;i++)
		{
			var row = [];
			matrix.push(row);
			for(var j=0;j<columns;j++)
			{
				row[j] = add(a[i][j]||0,b[i][j]||0);
			}
		}
		matrix.rows = rows;
		matrix.columns = columns;
		return matrix;
	},

	/** Subtract one matrix from another
	 *
	 * @param {matrix} a
	 * @param {matrix} b
	 * @returns {matrix}
	 */
	sub: function(a,b) {
		var rows = Math.max(a.rows,b.rows);
		var columns = Math.max(a.columns,b.columns);
		var matrix = [];
		for(var i=0;i<rows;i++)
		{
			var row = [];
			matrix.push(row);
			for(var j=0;j<columns;j++)
			{
				row[j] = sub(a[i][j]||0,b[i][j]||0);
			}
		}
		matrix.rows = rows;
		matrix.columns = columns;
		return matrix;
	},
	
	/** Matrix determinant. Only works up to 3x3 matrices.
	 * @param {matrix} m
	 * @returns {number}
	 * @throws {NumbasError} "matrixmath.abs.too big" if the matrix has more than 3 rows.
	 */
	abs: function(m) {
		if(m.rows!=m.columns)
			throw(new Numbas.Error('matrixmath.abs.non-square'));

		//abstraction failure!
		switch(m.rows)
		{
		case 1:
			return m[0][0];
		case 2:
			return sub( mul(m[0][0],m[1][1]), mul(m[0][1],m[1][0]) );
		case 3:
			return add( sub(
							mul(m[0][0],sub(mul(m[1][1],m[2][2]),mul(m[1][2],m[2][1]))),
							mul(m[0][1],sub(mul(m[1][0],m[2][2]),mul(m[1][2],m[2][0])))
						),
						mul(m[0][2],sub(mul(m[1][0],m[2][1]),mul(m[1][1],m[2][0])))
					);
		default:
			throw(new Numbas.Error('matrixmath.abs.too big'));
		}
	},

	/** Multiply a matrix by a scalar
	 * @param {number} k
	 * @param {matrix} m
	 * @returns {matrix}
	 */
	scalarmul: function(k,m) {
		var out = m.map(function(row){ return row.map(function(x){ return mul(k,x); }); });
		out.rows = m.rows;
		out.columns = m.columns;
		return out;
	},

	/** Divide a matrix by a scalar
	 * @param {matrix} m
	 * @param {number} k
	 * @returns {matrix}
	 */
	scalardiv: function(m,k) {
		var out = m.map(function(row){ return row.map(function(x){ return div(x,k); }); });
		out.rows = m.rows;
		out.columns = m.columns;
		return out;
	},

	/** Multiply two matrices
	 * @param {matrix} a
	 * @param {matrix} b
	 * @returns {matrix}
	 * @throws {NumbasError} "matrixmath.mul.different sizes" if `a` doesn't have as many columns as `b` has rows.
	 */
	mul: function(a,b) {
		if(a.columns!=b.rows)
			throw(new Numbas.Error('matrixmath.mul.different sizes'));

		var out = [];
		out.rows = a.rows;
		out.columns = b.columns;
		for(var i=0;i<a.rows;i++)
		{
			var row = [];
			out.push(row);
			for(var j=0;j<b.columns;j++)
			{
				var s = 0;
				for(var k=0;k<a.columns;k++)
				{
					s = add(s,mul(a[i][k],b[k][j]));
				}
				row.push(s);
			}
		}
		return out;
	},

	/** Are two matrices equal? True if each pair of corresponding elements is equal.
	 * @param {matrix} a
	 * @param {matrix} b
	 * @returns {boolean}
	 */
	eq: function(a,b) {
		var rows = Math.max(a.rows,b.rows);
		var columns = Math.max(a.columns,b.columns);
		for(var i=0;i<rows;i++)
		{
			var rowA = a[i] || [];
			var rowB = b[i] || [];
			for(var j=0;j<rows;j++)
			{
				if(!eq(rowA[j]||0,rowB[j]||0))
					return false;
			}
		}
		return true;
	},

	/** Are two matrices unequal?
	 * @param {matrix} a
	 * @param {matrix} b
	 * @returns {boolean}
	 * @see {Numbas.matrixmath.eq}
	 */
	neq: function(a,b) {
		return !matrixmath.eq(a,b);
	},

	/** Make an `NxN` identity matrix.
	 * @param {number} n
	 * @returns {matrix}
	 */
	id: function(n) {
		var out = [];
		out.rows = out.columns = n;
		for(var i=0;i<n;i++)
		{
			var row = [];
			out.push(row);
			for(var j=0;j<n;j++)
				row.push(j==i ? 1 : 0);
		}
		return out;
	},

	/** Matrix transpose
	 * @param {matrix}
	 * @returns {matrix}
	 */
	transpose: function(m) {
		var out = [];
		out.rows = m.columns;
		out.columns = m.rows;

		for(var i=0;i<m.columns;i++)
		{
			var row = [];
			out.push(row);
			for(var j=0;j<m.rows;j++)
			{
				row.push(m[j][i]||0);
			}
		}
		return out;
	},

	/** Apply given function to each element
	 * @param {matrix}
	 * @param {function}
	 * @returns {matrix}
	 */
	map: function(m,fn) {
		var out = m.map(function(row){
			return row.map(fn);
		});
		out.rows = m.rows;
		out.columns = m.columns;
		return out;
	},

	/** Round each element to given number of decimal places
	 * @param {matrix}
	 * @param {number} - number of decimal places
	 * @returns {matrix}
	 */
	precround: function(m,dp) {
		return matrixmath.map(m,function(n){return math.precround(n,dp);});
	},

	/** Round each element to given number of significant figures
	 * @param {matrix}
	 * @param {number} - number of decimal places
	 * @returns {matrix}
	 */
	siground: function(m,sf) {
		return matrixmath.map(m,function(n){return math.siground(n,sf);});
	}
}


/** Set operations.
 *
 * @namespace Numbas.setmath
 */
var setmath = Numbas.setmath = {
	/** Does the set contain the given element?
	 * @param {set} set
	 * @param {object} element
	 * @returns {bool}
	 */
	contains: function(set,element) {
		for(var i=0,l=set.length;i<l;i++) {
			if(Numbas.util.eq(set[i],element)) {
				return true;
			}
		}
	},

	/** Union of two sets
	 * @param {set} a
	 * @param {set} b
	 * @returns {set}
	 */
	union: function(a,b) {
		var out = a.slice();
		for(var i=0,l=b.length;i<l;i++) {
			if(!setmath.contains(a,b[i])) {
				out.push(b[i]);
			}
		}
		return out;
	},
	
	/** Intersection of two sets
	 * @param {set} a
	 * @param {set} b
	 * @returns {set}
	 */
	intersection: function(a,b) {
		return a.filter(function(v) {
			return setmath.contains(b,v);
		});
	},

	/** Are two sets equal? Yes if a,b and (a intersect b) all have the same length
	 * @param {set} a
	 * @param {set} b
	 * @returns {bool}
	 */
	eq: function(a,b) {	
		return a.length==b.length && setmath.intersection(a,b).length==a.length;
	},

	/** Set minus - remove b's elements from a
	 * @param {set} a
	 * @param {set} b
	 * @returns {set}
	 */
	minus: function(a,b) {
		return a.filter(function(v){ return !setmath.contains(b,v); });
	}
}

});

/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/** @file Sets up most of the JME stuff: compiler, built-in functions, and expression comparison functions.
 *
 * Provides {@link Numbas.jme}
 */

Numbas.queueScript('jme',['base','math','util'],function() {

var util = Numbas.util;
var math = Numbas.math;
var vectormath = Numbas.vectormath;
var matrixmath = Numbas.matrixmath;
var setmath = Numbas.setmath;

/** @typedef Numbas.jme.tree
  * @type {object}
  * @property {tree[]} args - the token's arguments (if it's an op or function)
  * @property {Numbas.jme.token} tok - the token at this node
  */

/** @namespace Numbas.jme */
var jme = Numbas.jme = /** @lends Numbas.jme */ {

	/** Mathematical constants */
	constants: {
		'e': Math.E,
		'pi': Math.PI,
		'i': math.complex(0,1),
		'infinity': Infinity,
		'infty': Infinity
	},

	/** Regular expressions to match tokens */
	re: {
		re_bool: /^true|^false/i,
		re_number: /^[0-9]+(?:\x2E[0-9]+)?/,
		re_name: /^{?((?:(?:[a-zA-Z]+):)*)((?:\$?[a-zA-Z_][a-zA-Z0-9_]*'*)|\?\??)}?/i,
		re_op: /^(\.\.|#|<=|>=|<>|&&|\|\||[\|*+\-\/\^<>=!&;]|(?:(not|and|or|xor|isa|except|in)([^a-zA-Z0-9]|$)))/i,
		re_punctuation: /^([\(\),\[\]])/,
		re_string: /^(['"])((?:[^\1\\]|\\.)*?)\1/,
		re_comment: /^\/\/.*(?:\n|$)/
	},

	/** Convert given expression string to a list of tokens. Does some tidying, e.g. inserts implied multiplication symbols.
	 * @param {JME} expr 
	 * @returns {token[]}
	 * @see Numbas.jme.compile
	 */
	tokenise: function(expr)
	{
		if(!expr)
			return [];

		expr += '';
		
		var oexpr = expr;

		expr = expr.replace(jme.re.re_strip_whitespace, '');	//get rid of whitespace

		var tokens = [];
		var i = 0;
		
		while( expr.length )
		{
			expr = expr.replace(jme.re.re_strip_whitespace, '');	//get rid of whitespace
		
			var result;
			var token;

            while(result=expr.match(jme.re.re_comment)) {
                expr=expr.slice(result[0].length).replace(jme.re.re_strip_whitespace,'');
            }

			if(result = expr.match(jme.re.re_number))
			{
				token = new TNum(result[0]);

				if(tokens.length>0 && (tokens[tokens.length-1].type==')' || tokens[tokens.length-1].type=='name'))	//right bracket followed by a number is interpreted as multiplying contents of brackets by number
				{
					tokens.push(new TOp('*'));
				}
			}
			else if (result = expr.match(jme.re.re_bool))
			{
				token = new TBool(util.parseBool(result[0]));
			}
			else if (result = expr.match(jme.re.re_op))
			{
				if(result[2])		//if word-ish operator
					result[0] = result[2];
				token = result[0];
				//work out if operation is being used prefix or postfix
				var nt;
				var postfix = false;
				var prefix = false;
				if( tokens.length==0 || (nt=tokens[tokens.length-1].type)=='(' || nt==',' || nt=='[' || (nt=='op' && !tokens[tokens.length-1].postfix) )
				{
					if(token in prefixForm) {
						token = prefixForm[token];
						prefix = true;
					}
				}
				else
				{
					if(token in postfixForm) {
						token = postfixForm[token];
						postfix = true;
					}
				}
				token=new TOp(token,postfix,prefix);
			}
			else if (result = expr.match(jme.re.re_name))
			{
				var name = result[2];
				var annotation = result[1] ? result[1].split(':').slice(0,-1) : null;
				if(!annotation)
				{
					var lname = name.toLowerCase();
					// fill in constants here to avoid having more 'variables' than necessary
					if(lname in jme.constants) {
						token = new TNum(jme.constants[lname]);
					}else{
						token = new TName(name);
					}
				}
				else
				{
					token = new TName(name,annotation);
				}
				
				if(tokens.length>0 && (tokens[tokens.length-1].type=='number' || tokens[tokens.length-1].type=='name' || tokens[tokens.length-1].type==')')) {	//number or right bracket or name followed by a name, eg '3y', is interpreted to mean multiplication, eg '3*y'
					tokens.push(new TOp('*'));
				}
			}
			else if (result = expr.match(jme.re.re_punctuation))
			{
				if(result[0]=='(' && tokens.length>0 && (tokens[tokens.length-1].type=='number' || tokens[tokens.length-1].type==')')) {	//number or right bracket followed by left parenthesis is also interpreted to mean multiplication
					tokens.push(new TOp('*'));
				}

				token = new TPunc(result[0]);
			}
			else if (result = expr.match(jme.re.re_string))
			{
				var str = result[2];
	
				var estr = '';
				while(true) {
					var i = str.indexOf('\\');
					if(i==-1)
						break;
					else {
						estr += str.slice(0,i);
						var c;
						if((c=str.charAt(i+1))=='n') {
							estr+='\n';
						}
						else if(c=='{' || c=='}') {
							estr+='\\'+c;
						}
						else {
							estr+=c;
						}
						str=str.slice(i+2);
					}
				}
				estr+=str;

				token = new TString(estr);
			}
			else if(expr.length)
			{
				//invalid character or not able to match a token
				throw(new Numbas.Error('jme.tokenise.invalid',oexpr));
			}
			else
				break;
			
			expr=expr.slice(result[0].length);	//chop found token off the expression
			
			tokens.push(token);
		}

		//rewrite some synonyms
		for(var i=0; i<tokens.length; i++)
		{
			if(tokens[i].name)
			{
				if(synonyms[tokens[i].name])
					tokens[i].name=synonyms[tokens[i].name];
			}
		}


		return(tokens);
	},

	/** Shunt list of tokens into a syntax tree. Uses the shunting yard algorithm (wikipedia has a good description)
	 * @param {token[]} tokens
	 * @param {Numbas.jme.Scope} scope
	 * @returns {Numbas.jme.tree}
	 * @see Numbas.jme.tokenise
	 * @see Numbas.jme.compile
	 */
	shunt: function(tokens,scope)
	{
		var output = [];
		var stack = [];
		
		var numvars=[],olength=[],listmode=[];

		function addoutput(tok)
		{
			if(tok.vars!==undefined)
			{
				if(output.length<tok.vars)
					throw(new Numbas.Error('jme.shunt.not enough arguments',tok.name || tok.type));

				var thing = {tok: tok,
							 args: output.slice(output.length-tok.vars)};
				output = output.slice(0,output.length-tok.vars);
				output.push(thing);
			}
			else
				output.push({tok:tok});
		}

		for(var i = 0;i < tokens.length; i++ )
		{
			var tok = tokens[i];
			
			switch(tok.type) 
			{
			case "number":
			case "string":
			case 'boolean':
				addoutput(tok);
				break;
			case "name":
				if( i<tokens.length-1 && tokens[i+1].type=="(")
				{
						stack.push(new TFunc(tok.name,tok.annotation));
						numvars.push(0);
						olength.push(output.length);
				}
				else 
				{										//this is a variable otherwise
					addoutput(tok);
				}
				break;
				
			case ",":
				while( stack.length && stack[stack.length-1].type != "(" && stack[stack.length-1].type != '[')
				{	//reached end of expression defining function parameter, so pop all of its operations off stack and onto output
					addoutput(stack.pop())
				}

				numvars[numvars.length-1]++;

				if( ! stack.length )
				{
					throw(new Numbas.Error('jme.shunt.no left bracket in function'));
				}
				break;
				
			case "op":

				if(!tok.prefix) {
					var o1 = precedence[tok.name];
					while(
							stack.length && 
							stack[stack.length-1].type=="op" && 
							(
							 (o1 > precedence[stack[stack.length-1].name]) || 
							 (
							  leftAssociative(tok.name) && 
							  o1 == precedence[stack[stack.length-1].name]
							 )
							)
					) 
					{	//while ops on stack have lower precedence, pop them onto output because they need to be calculated before this one. left-associative operators also pop off operations with equal precedence
						addoutput(stack.pop());
					}
				}
				stack.push(tok);
				break;

			case '[':
				if(i==0 || tokens[i-1].type=='(' || tokens[i-1].type=='[' || tokens[i-1].type==',' || tokens[i-1].type=='op')	//define list
				{
					listmode.push('new');
				}
				else		//list index
					listmode.push('index');

				stack.push(tok);
				numvars.push(0);
				olength.push(output.length);
				break;

			case ']':
				while( stack.length && stack[stack.length-1].type != "[" ) 
				{
					addoutput(stack.pop());
				}
				if( ! stack.length ) 
				{
					throw(new Numbas.Error('jme.shunt.no left square bracket'));
				}
				else
				{
					stack.pop();	//get rid of left bracket
				}

				//work out size of list
				var n = numvars.pop();
				var l = olength.pop();
				if(output.length>l)
					n++;

				switch(listmode.pop())
				{
				case 'new':
					addoutput(new TList(n))
					break;
				case 'index':
					var f = new TFunc('listval');
					f.vars = 2;
					addoutput(f);
					break;
				}
				break;
				
			case "(":
				stack.push(tok);
				break;
				
			case ")":
				while( stack.length && stack[stack.length-1].type != "(" ) 
				{
					addoutput(stack.pop());
				}
				if( ! stack.length ) 
				{
					throw(new Numbas.Error('jme.shunt.no left bracket'));
				}
				else
				{
					stack.pop();	//get rid of left bracket

					//if this is a function call, then the next thing on the stack should be a function name, which we need to pop
					if( stack.length && stack[stack.length-1].type=="function") 
					{	
						//work out arity of function
						var n = numvars.pop();
						var l = olength.pop();
						if(output.length>l)
							n++;
						var f = stack.pop();
						f.vars = n;

						addoutput(f);
					}
				}
				break;
			}
		}

		//pop all remaining ops on stack into output
		while(stack.length)
		{
			var x = stack.pop();
			if(x.type=="(")
			{
				throw(new Numbas.Error('jme.shunt.no right bracket'));
			}
			else
			{
				addoutput(x);
			}
		}

		if(listmode.length>0)
			throw(new Numbas.Error('jme.shunt.no right square bracket'));

		if(output.length>1)
			throw(new Numbas.Error('jme.shunt.missing operator'));

		return(output[0]);
	},

	/** Substitute variables defined in `scope` into the given syntax tree (in place).
	 * @param {Numbas.jme.tree} tree
	 * @param {Numbas.jme.Scope} scope
	 * @param {boolean} [allowUnbound=false] - allow unbound variables to remain in the returned tree
	 * @returns {Numbas.jme.tree}
	 */
	substituteTree: function(tree,scope,allowUnbound)
	{
		if(!tree)
			return null;
		if(tree.tok.bound)
			return tree;

		if(tree.args===undefined)
		{
			if(tree.tok.type=='name')
			{
				var name = tree.tok.name.toLowerCase();
				if(scope.variables[name]===undefined)
				{
					if(allowUnbound)
						return {tok: new TName(name)};
					else
						throw new Numbas.Error('jme.substituteTree.undefined variable',name);
				}
				else
				{
					if(scope.variables[name].tok)
						return scope.variables[name];
					else
						return {tok: scope.variables[name]};
				}
			}
			else
				return tree;
		}
		else
		{
			tree = {tok: tree.tok,
					args: tree.args.slice()};
			for(var i=0;i<tree.args.length;i++)
				tree.args[i] = jme.substituteTree(tree.args[i],scope,allowUnbound);
			return tree;
		}
	},

	/** Evaluate a syntax tree (or string, which is compiled to a syntax tree), with respect to the given scope.
	 * @param {tree|string} tree
	 * @param {Numbas.jme.Scope} scope
	 * @returns {jme.type}
	 */
	evaluate: function(tree,scope)
	{
		//if a string is given instead of an expression tree, compile it to a tree
		if( typeof(tree)=='string' )
			tree = jme.compile(tree,scope);
		if(!tree)
			return null;


		tree = jme.substituteTree(tree,scope,true);

		var tok = tree.tok;
		switch(tok.type)
		{
		case 'number':
		case 'boolean':
		case 'range':
			return tok;
		case 'list':
			if(tok.value===undefined)
			{
				var value = [];
				for(var i=0;i<tree.args.length;i++)
				{
					value[i] = jme.evaluate(tree.args[i],scope);
				}
				tok = new TList(value);
			}
			return tok;
		case 'string':
			var value = tok.value;
			if(value.contains('{'))
				value = jme.contentsubvars(value,scope)
			var t = new TString(value);
			t.latex = tok.latex;
			return t;
		case 'name':
			if(tok.name.toLowerCase() in scope.variables)
				return scope.variables[tok.name.toLowerCase()];
			else
				tok.unboundName = true;
				return tok;
			break;
		case 'op':
		case 'function':
			var op = tok.name.toLowerCase();
			if(lazyOps.indexOf(op)>=0) {
				return scope.functions[op][0].evaluate(tree.args,scope);
			}
			else {

				for(var i=0;i<tree.args.length;i++) {
					tree.args[i] = jme.evaluate(tree.args[i],scope);
				}

				if(scope.functions[op]===undefined)
				{
					if(tok.type=='function') {
						//check if the user typed something like xtan(y), when they meant x*tan(y)
						var possibleOp = op.slice(1);
						if(possibleOp in scope.functions)
							throw(new Numbas.Error('jme.typecheck.function maybe implicit multiplication',op,op[0],possibleOp));
						else
							throw(new Numbas.Error('jme.typecheck.function not defined',op,op));
					}
					else
						throw(new Numbas.Error('jme.typecheck.op not defined',op));
				}

				for(var j=0;j<scope.functions[op].length; j++)
				{
					var fn = scope.functions[op][j];
					if(fn.typecheck(tree.args))
					{
						tok.fn = fn;
						break;
					}
				}
				if(tok.fn)
					return tok.fn.evaluate(tree.args,scope);
				else {
					for(var i=0;i<=tree.args.length;i++) {
						if(tree.args[i] && tree.args[i].unboundName) {
							throw(new Numbas.Error('jme.typecheck.no right type unbound name',tree.args[i].name));
						}
					}
					throw(new Numbas.Error('jme.typecheck.no right type definition',op));
				}
			}
		default:
			return tok;
		}
	},

	/** Compile an expression string to a syntax tree. (Runs {@link Numbas.jme.tokenise} then {@Link Numbas.jme.shunt})
	 * @param {JME} expr
	 * @param {Numbas.jme.Scope} scope
	 * @see Numbas.jme.tokenise
	 * @see Numbas.jme.shunt
	 * @returns {Numbas.jme.tree}
	 */
	compile: function(expr,scope)
	{
		expr+='';	//make sure expression is a string and not a number or anything like that

		if(!expr.trim().length)
			return null;
		//typecheck
		scope = new Scope(scope);

		//tokenise expression
		var tokens = jme.tokenise(expr);

		//compile to parse tree
		var tree = jme.shunt(tokens,scope);

		if(tree===null)
			return;

		return(tree);
	},

	/** Compare two expressions over some randomly selected points in the space of variables, to decide if they're equal.
	 * @param {JME} expr1
	 * @param {JME} expr2
	 * @param {object} settings
	 * @param {Numbas.jme.Scope} scope
	 * @returns {boolean}
	 */
	compare: function(expr1,expr2,settings,scope) {
		expr1 += '';
		expr2 += '';

		var compile = jme.compile, evaluate = jme.evaluate;

		var checkingFunction = checkingFunctions[settings.checkingType.toLowerCase()];	//work out which checking type is being used

		try {
			var tree1 = compile(expr1,scope);
			var tree2 = compile(expr2,scope);

			if(tree1 == null || tree2 == null) 
			{	//one or both expressions are invalid, can't compare
				return false; 
			}

			//find variable names used in both expressions - can't compare if different
			var vars1 = findvars(tree1);
			var vars2 = findvars(tree2);

			for(var v in scope.variables)
			{
				delete vars1[v];
				delete vars2[v];
			}
			
			if( !varnamesAgree(vars1,vars2) ) 
			{	//whoops, differing variables
				return false;
			}

			if(vars1.length) 
			{	// if variables are used,  evaluate both expressions over a random selection of values and compare results
				var errors = 0;
				var rs = randoms(vars1, settings.vsetRangeStart, settings.vsetRangeEnd, settings.vsetRangePoints);
				for(var i = 0; i<rs.length; i++) {
					var nscope = new jme.Scope([scope,{variables:rs[i]}]);
					util.copyinto(scope.variables,rs[i]);
					var r1 = evaluate(tree1,nscope);
					var r2 = evaluate(tree2,nscope);
					if( !resultsEqual(r1,r2,checkingFunction,settings.checkingAccuracy) ) { errors++; }
				}
				if(errors < settings.failureRate) {
					return true;
				}else{
					return false;
				}
			} else {
				//if no variables used, can just evaluate both expressions once and compare
				r1 = evaluate(tree1,scope);
				r2 = evaluate(tree2,scope);
				return resultsEqual(r1,r2,checkingFunction,settings.checkingAccuracy);
			}
		}
		catch(e) {
			return false;
		}

	},

	/** Substitute variables into content. To substitute variables, use {@link Numbas.jme.variables.DOMcontentsubvars}.
	 * @param {string} str
	 * @param {Numbas.jme.Scope} scope
	 * @returns {string}
	 */
	contentsubvars: function(str, scope)
	{
		var bits = util.contentsplitbrackets(str);	//split up string by TeX delimiters. eg "let $X$ = \[expr\]" becomes ['let ','$','X','$',' = ','\[','expr','\]','']
		for(var i=0; i<bits.length; i+=4)
		{
			bits[i] = jme.subvars(bits[i],scope,true);
		}
		return bits.join('');
	},

	/** Split up a string along TeX delimiters (`$`, `\[`, `\]`)
	 * @param {string} s
	 * @returns {string[]}
	 */
	texsplit: function(s)
	{
		var cmdre = /^((?:.|[\n\r])*?)\\(var|simplify)/m;
		var out = [];
		var m;
		while( m = s.match(cmdre) )
		{
			out.push(m[1]);
			var cmd = m[2];
			out.push(cmd);

			var i = m[0].length;

			var args = '';
			var argbrackets = false;
			if( s.charAt(i) == '[' )
			{
				argbrackets = true;
				var si = i+1;
				while(i<s.length && s.charAt(i)!=']')
					i++;
				if(i==s.length)
					throw(new Numbas.Error('jme.texsubvars.no right bracket',cmd));
				else
				{
					args = s.slice(si,i);
					i++;
				}
			}
			if(!argbrackets)
				args='all';
			out.push(args);

			if(s.charAt(i)!='{')
			{
				throw(new Numbas.Error('jme.texsubvars.missing parameter',cmd,s));
			}

			var brackets=1;
			var si = i+1;
			while(i<s.length-1 && brackets>0)
			{
				i++;
				if(s.charAt(i)=='{')
					brackets++;
				else if(s.charAt(i)=='}')
					brackets--;
			}
			if(i == s.length-1 && brackets>0)
				throw(new Numbas.Error('jme.texsubvars.no right brace',cmd));

			var expr = s.slice(si,i);
			s = s.slice(i+1);
			out.push(expr);
		}
		out.push(s);
		return out;
	},

	/** Substitute variables into a text string (not maths).
	 * @param {string} str
	 * @param {Numbas.jme.Scope} scope
	 * @param {boolean} [display=false] - Is this string going to be displayed to the user? If so, avoid unnecessary brackets and quotes.
	 */
	subvars: function(str, scope,display)
	{
		var bits = util.splitbrackets(str,'{','}');
		if(bits.length==1)
		{
			return str;
		}
		var out = '';
		for(var i=0; i<bits.length; i++)
		{
			if(i % 2)
			{
				var v = jme.evaluate(jme.compile(bits[i],scope),scope);
				if(v.type=='number')
				{
					if(display)
						v = ''+Numbas.math.niceNumber(v.value)+'';
					else
						v = '('+Numbas.jme.display.treeToJME({tok:v})+')';
				}
				else if(v.type=='string')
				{
					if(display) {
						v = v.value;
					}
					else {
						v = "'"+v.value+"'";
					}
				}
				else
				{
					v = jme.display.treeToJME({tok:v});
				}

				out += v;
			}
			else
			{
				out+=bits[i];
			}
		}
		return out;
	},

	/** Unwrap a {@link Numbas.jme.token} into a plain JavaScript value
	 * @param {Numbas.jme.token} v
	 * @returns {object}
	 */
	unwrapValue: function(v) {
		if(v.type=='list')
			return v.value.map(jme.unwrapValue);
		else
			return v.value;
	},
	
	/** Wrap up a plain JavaScript value (number, string, bool or array) as a {@link Numbas.jme.token}.
	 * @param {object} v
	 * @returns {Numbas.jme.token}
	 */
	wrapValue: function(v) {
		switch(typeof v) {
		case 'number':
			return new jme.types.TNum(v);
		case 'string':
			return new jme.types.TString(v);
		case 'boolean':
			return new jme.types.TBool(v);
		default:
			if($.isArray(v)) {
				v = v.map(jme.wrapValue);
				return new jme.types.TList(v);
			}
			return v;
		}
	},

	/** Is a token a TOp?
	 *
	 * @param {Numbas.jme.token} 
	 * 
	 * @returns {boolean}
	 */
	isOp: function(tok,op) {
		return tok.type=='op' && tok.name==op;
	},

	/** Is a token a TName?
	 *
	 * @param {Numbas.jme.token} 
	 * 
	 * @returns {boolean}
	 */
	isName: function(tok,name) {
		return tok.type=='name' && tok.name==name;
	},

	/** Is a token a TFunction?
	 *
	 * @param {Numbas.jme.token} 
	 * 
	 * @returns {boolean}
	 */
	isFunction: function(tok,name) {
		return tok.type=='function' && tok.name==name;
	}
};

/** Regular expression to match whitespace (because '\s' doesn't match *everything*) */
jme.re.re_whitespace = '(?:[\\s \\f\\n\\r\\t\\v\\u00A0\\u2028\\u2029]|(?:\&nbsp;))';
jme.re.re_strip_whitespace = new RegExp('^'+jme.re.re_whitespace+'+|'+jme.re.re_whitespace+'+$','g');


var displayFlags = {
	fractionnumbers: undefined,
	rowvector: undefined
};

var ruleSort = util.sortBy('patternString');

/** Set of simplification rules
 * @constructor
 * @memberof Numbas.jme
 * @param {rule[]} rules
 * @param {object} flags
 */
var Ruleset = jme.Ruleset = function(rules,flags) {
	this.rules = rules;
	this.flags = $.extend({},displayFlags,flags);
}
Ruleset.prototype = /** @lends Numbas.jme.Ruleset.prototype */ {
	/** Test whether flag is set 
	 * @memberof Numbas.jme.Ruleset.prototype
	 */
	flagSet: function(flag) {
		flag = flag.toLowerCase();
		if(this.flags.hasOwnProperty(flag))
			return this.flags[flag];
		else
			return false;
	}
}

function mergeRulesets(r1,r2) {
	var rules = r1.rules.merge(r2.rules,ruleSort);
	var flags = $.extend({},r1.flags,r2.flags);
	return new Ruleset(rules, flags);
}

//collect a ruleset together from a list of ruleset names, or rulesets.
// set can be a comma-separated string of ruleset names, or an array of names/Ruleset objects.
var collectRuleset = jme.collectRuleset = function(set,scopeSets)
{
	scopeSets = util.copyobj(scopeSets);

	if(!set)
		return [];

	if(!scopeSets)
		throw(new Numbas.Error('jme.display.collectRuleset.no sets'));

	var rules = [];
	var flags = {};

	if(typeof(set)=='string') {
		set = set.split(',');
	}
	else {
		flags = $.extend(flags,set.flags);
		if(set.rules)
			set = set.rules;
	}

	for(var i=0; i<set.length; i++ )
	{
		if(typeof(set[i])=='string')
		{
			var m = /^\s*(!)?(.*)\s*$/.exec(set[i]);
			var neg = m[1]=='!' ? true : false;
			var name = m[2].trim().toLowerCase();
			if(name in displayFlags)
			{
				flags[name]= !neg;
			}
			else if(name.length>0)
			{
				if(!(name in scopeSets))
				{
					throw(new Numbas.Error('jme.display.collectRuleset.set not defined',name));
				}

				var sub = collectRuleset(scopeSets[name],scopeSets);

				flags = $.extend(flags,sub.flags);

				scopeSets[name] = sub;
				if(neg)
				{
					for(var j=0; j<sub.rules.length; j++)
					{
						if((m=rules.indexOf(sub.rules[j]))>=0)
						{
							rules.splice(m,1);
						}
					}
				}
				else
				{
					for(var j=0; j<sub.rules.length; j++)
					{
						if(!(rules.contains(sub.rules[j])))
						{
							rules.push(sub.rules[j]);
						}
					}
				}
			}
		}
		else
			rules.push(set[i]);
	}
	return new Ruleset(rules,flags);
}

var fnSort = util.sortBy('id');

/**
 * JME evaluation environment.
 * @memberof Numbas.jme
 * @constructor
 * @property {object} variables - dictionary of {@link Numbas.jme.token} objects
 * @property {object} functions - dictionary of arrays of {@link Numbas.jme.funcObj} objects. There can be more than one function for each name because of signature overloading.
 * @property {objects} rulesets - dictionary of {@link Numbas.jme.Ruleset} objects
 *
 * @param {Numbas.jme.Scope[]} scopes - List of scopes to combine into this one. Scopes appearing later in the list override ones appearing earlier, in case variable/ruleset names conflict.
 */
var Scope = jme.Scope = function(scopes) {
	this.variables = {};
	this.functions = {};
	this.rulesets = {};

	if(scopes===undefined)
		return;

	if(!$.isArray(scopes))
		scopes = [scopes];

	for(var i=0;i<scopes.length;i++) {
		var scope = scopes[i];
		if(scope) {
			if('variables' in scope) {
				for(var x in scope.variables) {
					this.variables[x] = scope.variables[x];
				}
			}
			if('functions' in scope) {
				for(var x in scope.functions) {
					if(!(x in this.functions))
						this.functions[x] = scope.functions[x].slice();
					else 
						this.functions[x] = this.functions[x].merge(scope.functions[x],fnSort);
				}
			}
			if('rulesets' in scope) {
				for(var x in scope.rulesets) {
					if(!(x in this.rulesets))
						this.rulesets[x] = scope.rulesets[x];
					else
						this.rulesets[x] = mergeRulesets(this.rulesets[x],scope.rulesets[x]);
				}
			}
		}
	}
}
Scope.prototype = /** @lends Numbas.jme.Scope.prototype */ {
	/** Add a JME function to the scope.
	 * @param {jme.funcObj} fn - function to add
	 */
	addFunction: function(fn) {
		if(!(fn.name in this.functions))
			this.functions[fn.name] = [fn];
		else
			this.functions[fn.name].push(fn);
	},

	/** Evaluate an expression in this scope - equivalent to `Numbas.jme.evaluate(expr,this)`
	 * @param {JME} expr
	 * @returns {token}
	 */
	evaluate: function(expr) {
		return jme.evaluate(expr,this);
	}
};


//a length-sorted list of all the builtin functions, for recognising stuff like xcos() as x*cos()
var builtinsbylength=[],builtinsre=new RegExp();
builtinsbylength.add = function(e)
{
	if(!e.match(/^[a-zA-Z]+$/)){return;}
	var l = e.length;
	for(var i=0;i<this.length;i++)
	{
		if(this[i].length<=l)
		{
			this.splice(i,0,e);
			builtinsre = new RegExp('('+builtinsbylength.join('|')+')$');
			return;
		}
	}
	this.push(e);
	builtinsre = new RegExp('('+builtinsbylength.join('|')+')$');
};


/** @typedef Numbas.jme.token
 * @type {object}
 * @property {string} type
 * @see Numbas.jme.types
 */

/** The data types supported by JME expressions 
 * @namespace Numbas.jme.types
 */
var types = jme.types = {}

/** Number type.
 * @memberof Numbas.jme.types
 * @augments Numbas.jme.token
 * @property {number} value
 * @property type "number"
 * @constructor
 * @param {number} num
 */
var TNum = types.TNum = types.number = function(num)
{
	if(num===undefined) 
		return;

	this.value = num.complex ? num : parseFloat(num);
}
TNum.prototype.type = 'number';
TNum.doc = {
	name: 'number',
	usage: ['0','1','0.234','i','e','pi'],
	description: "@i@, @e@, @infinity@ and @pi@ are reserved keywords for the imaginary unit, the base of the natural logarithm, $\\infty$ and $\\pi$, respectively."
};

/** String type.
 * @memberof Numbas.jme.types
 * @augments Numbas.jme.token
 * @property {string} value
 * @property type "string"
 * @constructor
 * @param {string} s
 */
var TString = types.TString = types.string = function(s)
{
	this.value = s;
}
TString.prototype.type = 'string';
TString.doc = {
	name: 'string',
	usage: ['\'hello\'','"hello"'],
	description: "Use strings to create non-mathematical text."
};

/** Boolean type
 * @memberof Numbas.jme.types
 * @augments Numbas.jme.token
 * @property {boolean} value
 * @property type "boolean"
 * @constructor
 * @param {boolean} b
 */
var TBool = types.TBool = types.boolean = function(b)
{
	this.value = b;
}
TBool.prototype.type = 'boolean';
TBool.doc = {
	name: 'boolean',
	usage: ['true','false'],
	description: "Booleans represent either truth or falsity. The logical operations @and@, @or@ and @xor@ operate on and return booleans."
}

/** HTML DOM element
 * @memberof Numbas.jme.types
 * @augments Numbas.jme.token
 * @property {element} value
 * @property type "html"
 * @constructor
 * @param {element} html
 */
var THTML = types.THTML = types.html = function(html) {
	this.value = $(html);
}
THTML.prototype.type = 'html';
THTML.doc = {
	name: 'html',
	usage: ['html(\'<div>things</div>\')'],
	description: "An HTML DOM node."
}


/** List of elements of any data type
 * @memberof Numbas.jme.types
 * @augments Numbas.jme.token
 * @property {number} vars - Length of list
 * @property {object[]} value - Values (may not be filled in if the list was created empty)
 * @property type "html"
 * @constructor
 * @param {number|object} value - Either the size of the list, or an array of values
 */
var TList = types.TList = types.list = function(value)
{
	switch(typeof(value))
	{
	case 'number':
		this.vars = value;
		break;
	case 'object':
		this.value = value;
		this.vars = value.length;
		break;
	default:
		this.vars = 0;
	}
}
TList.prototype.type = 'list';
TList.doc = {
	name: 'list',
	usage: ['[0,1,2,3]','[a,b,c]','[true,false,false]'],
	description: "A list of elements of any data type."
};

/** Set type
 * @memberof Numbas.jme.types
 * @augments Numbas.jme.token
 * @property {object[]} value - Array of elements. Constructor assumes all elements are distinct
 * @property type "set"
 * @constructor
 * @param {object[]} value
 */
var TSet = types.TSet = types.set = function(value) {
	this.value = value;
}
TSet.prototype.type = 'set';

/** Vector type
 * @memberof Numbas.jme.types
 * @augments Numbas.jme.token
 * @property {number[]} value - Array of components
 * @property type "vector"
 * @constructor
 * @param {number[]} value
 */
var TVector = types.TVector = types.vector = function(value)
{
	this.value = value;
}
TVector.prototype.type = 'vector';
TVector.doc = {
	name: 'vector',
	usage: ['vector(1,2)','vector([1,2,3,4])'],
	description: 'The components of a vector must be numbers.\n\n When combining vectors of different dimensions, the smaller vector is padded with zeroes to make up the difference.'
}

/** Matrix type
 * @memberof Numbas.jme.types
 * @augments Numbas.jme.token
 * @property {matrix} value - Array of rows (which are arrays of numbers)
 * @property type "matrix"
 * @constructor
 * @param {matrix} value
 */
var TMatrix = types.TMatrix = types.matrix = function(value)
{
	this.value = value;
}
TMatrix.prototype.type = 'matrix';
TMatrix.doc = {
	name: 'matrix',
	usage: ['matrix([1,2,3],[4,5,6])','matrix(row1,row2)'],
	description: "Matrices are constructed from lists of numbers, representing the rows.\n\n When combining matrices of different dimensions, the smaller matrix is padded with zeroes to make up the difference."
}

/** A range of numerical values - either discrete or continuous
 * @memberof Numbas.jme.types
 * @augments Numbas.jme.token
 * @property {number[]} value - `[start,end,step]` and then, if the range is discrete, all the values included in the range.
 * @property {number} size - the number of values in the range (if it's discrete, `undefined` otherwise)
 * @property type "range"
 * @constructor
 * @param {number[]} range - `[start,end,step]`
 */
var TRange = types.TRange = types.range = function(range)
{
	this.value = range;
	if(this.value!==undefined)
	{
		var start = this.value[0], end = this.value[1], step = this.value[2];

		//if range is discrete, store all values in range so they don't need to be computed each time
		if(step != 0)
		{
			var n = (end-start)/step;
			this.size = n+1;
			for(var i=0;i<=n;i++)
			{
				this.value[i+3] = start+i*step;
			}
		}
	}
}
TRange.prototype.type = 'range';
TRange.doc = {
	name: 'range',
	usage: ['1..3','1..3#0.1','1..3#0'],
	description: 'A range @a..b#c@ represents the set of numbers $\\{a+nc | 0 \\leq n \\leq \\frac{b-a}{c} \\}$. If the step size is zero, then the range is the continuous interval $\[a,b\]$.'
}

/** Variable name token
 * @memberof Numbas.jme.types
 * @augments Numbas.jme.token
 * @property {string} name
 * @property {string} value - Same as `name`
 * @property {string[]} annotation - List of annotations (used to modify display)
 * @property type "name"
 * @constructor
 * @param {string} name
 * @param {string[]} annotation
 */
var TName = types.TName = types.name = function(name,annotation)
{
	this.name = name;
	this.value = name;
	this.annotation = annotation;
}
TName.prototype.type = 'name';
TName.doc = {
	name: 'name',
	usage: ['x','X','x1','longName','dot:x','vec:x'],
	description: 'A variable or function name. Names are case-insensitive, so @x@ represents the same thing as @X@. \
\n\n\
@e@, @i@ and @pi@ are reserved names representing mathematical constants. They are rewritten by the interpreter to their respective numerical values before evaluation. \
\n\n\
Names can be given _annotations_ to change how they are displayed. The following annotations are built-in:\
\n\n\
* @verb@ - does nothing, but names like @i@, @pi@ and @e@ are not interpreted as the famous mathematical constants.\n\
* @op@ - denote the name as the name of an operator -- wraps the name in the LaTeX @\\operatorname@ command when displayed\n\
* @v@ or @vector@ - denote the name as representing a vector -- the name is displayed in boldface\n\
* @unit@ - denote the name as representing a unit vector -- places a hat above the name when displayed\n\
* @dot@ - places a dot above the name when displayed, for example when representing a derivative\n\
* @m@ or @matrix@ - denote the name as representing a matrix -- displayed using a non-italic font\
\n\n\
Any other annotation is taken to be a LaTeX command. For example, a name @vec:x@ is rendered in LaTeX as <code>\\vec{x}</code>, which places an arrow above the name.\
	'
};

/** JME function token
 * @memberof Numbas.jme.types
 * @augments Numbas.jme.token
 * @property {string} name
 * @property {string[]} annotation - List of annotations (used to modify display)
 * @property {number} vars - Arity of the function
 * @property type "function"
 * @constructor
 * @param {string} name
 * @param {string[]} annotation
 */
var TFunc = types.TFunc = types['function'] = function(name,annotation)
{
	this.name = name;
	this.annotation = annotation;
}
TFunc.prototype.type = 'function';
TFunc.prototype.vars = 0;

/** Unary/binary operation token
 * @memberof Numbas.jme.types
 * @augments Numbas.jme.token
 * @property {string} name
 * @property {number} vars - Arity of the operation
 * @property {boolean} postfix
 * @property {boolean} prefix
 * @properrty type "op"
 * @constructor
 * @param {string} op - Name of the operation
 * @param {boolean} postfix
 * @param {boolean} prefix
 */
var TOp = types.TOp = types.op = function(op,postfix,prefix)
{
	var arity = 2;
	if(jme.arity[op]!==undefined)
		arity = jme.arity[op];

	this.name = op;
	this.postfix = postfix || false;
	this.prefix = prefix || false;
	this.vars = arity;
}
TOp.prototype.type = 'op';

/** Punctuation token
 * @memberof Numbas.jme.types
 * @augments Numbas.jme.token
 * @property {string} type - The punctuation character
 * @constructor
 * @param {string} kind - The punctuation character
 */
var TPunc = types.TPunc = function(kind)
{
	this.type = kind;
}


/** Arities of built-in operations
 * @readonly
 * @memberof Numbas.jme
 * @enum {number} */
var arity = jme.arity = {
	'!': 1,
	'not': 1,
	'fact': 1,
	'+u': 1,
	'-u': 1
}

/** Some names represent different operations when used as prefix. This dictionary translates them.
 * @readonly
 * @memberof Numbas.jme
 * @enum {string}
 */
var prefixForm = {
	'+': '+u',
	'-': '-u',
	'!': 'not'
}
/** Some names represent different operations when used as prefix. This dictionary translates them.
 * @readonly
 * @memberof Numbas.jme
 * @enum {string}
 */
var postfixForm = {
	'!': 'fact'
}

/** Operator precedence
 * @enum {number}
 * @memberof Numbas.jme
 * @readonly
 */
var precedence = jme.precedence = {
	';': 0,
	'fact': 1,
	'not': 1,
	'+u': 2.5,
	'-u': 2.5,
	'^': 2,
	'*': 3,
	'/': 3,
	'+': 4,
	'-': 4,
	'|': 5,
	'..': 5,
	'#':6,
	'except': 6.5,
	'in': 6.5,
	'<': 7,
	'>': 7,
	'<=': 7,
	'>=': 7,
	'<>': 8,
	'=': 8,
	'isa': 9,
	'and': 11,
	'or': 12,
	'xor': 13
};

/** Synonyms of names - keys in this dictionary are translated to their corresponding values after tokenising.
 * @enum {string}
 * @memberof Numbas.jme
 * @readonly
 */
var synonyms = jme.synonyms = {
	'&':'and',
	'&&':'and',
	'divides': '|',
	'||':'or',
	'sqr':'sqrt',
	'gcf': 'gcd',
	'sgn':'sign',
	'len': 'abs',
	'length': 'abs',
	'verb': 'verbatim'
};
	
/** Operations which evaluate lazily - they don't need to evaluate all of their arguments 
 * @memberof Numbas.jme
 */
var lazyOps = jme.lazyOps = ['if','switch','repeat','map','isa','satisfy'];

var rightAssociative = {
	'^': true,
	'+u': true,
	'-u': true
}

function leftAssociative(op)
{
	// check for left-associativity because that is the case when you do something more
	// exponentiation is only right-associative operation at the moment
	return !(op in rightAssociative);
};

/** Operations which commute.
 * @enum {boolean}
 * @memberof Numbas.jme
 * @readonly
 */
var commutative = jme.commutative =
{
	'*': true,
	'+': true,
	'and': true,
	'=': true
};


var funcObjAcc = 0;	//accumulator for ids for funcObjs, so they can be sorted
/**
 * Function object - for doing type checking away from the evaluator.
 * 
 * `options` can contain any of
 *
 * - `typecheck`: a function which checks whether the funcObj can be applied to the given arguments 
 * - `evaluate`: a function which performs the funcObj on given arguments and variables. Arguments are passed as expression trees, i.e. unevaluated
 * - `unwrapValues`: unwrap list elements in arguments into javascript primitives before passing to the evaluate function
 *
 * @memberof Numbas.jme
 * @constructor
 * @param {string} name
 * @param {function[]|string[]} intype - A list of data type constructors for the function's paramters' types. Use the string '?' to match any type. Or, give the type's name with a '*' in front to match any number of that type.
 * @param {function} outcons - The constructor for the output value of the function
 * @param {function} fn - JavaScript code which evaluates the function.
 * @param {object} options
 *
 */
var funcObj = jme.funcObj = function(name,intype,outcons,fn,options)
{
	/** 
	 * @member {number} 
	 * @memberof Numbas.jme.funcObj 
	 */
	this.id = funcObjAcc++;
	options = options || {};
	for(var i=0;i<intype.length;i++)
	{
		if(intype[i]!='?' && intype[i]!='?*')
		{
			if(intype[i][0]=='*')
			{
				var type = types[intype[i].slice(1)];
				intype[i] = '*'+type.prototype.type;
			}
			else
			{
				intype[i]=intype[i].prototype.type;
			}
		}
	}

	name = name.toLowerCase();

	this.name=name;
	this.intype = intype;
	if(typeof(outcons)=='function')
		this.outtype = new outcons().type;
	else
		this.outtype = '?';
	this.outcons = outcons;
	this.fn = fn;

	this.typecheck = options.typecheck || function(variables)
	{
		variables = variables.slice();	//take a copy of the array

		for( var i=0; i<this.intype.length; i++ )
		{
			if(this.intype[i][0]=='*')	//arbitrarily many
			{
				var ntype = this.intype[i].slice(1);
				while(variables.length)
				{
					if(variables[0].type==ntype || ntype=='?' || variables[0].type=='?')
						variables = variables.slice(1);
					else
						return false;
				}
			}else{
				if(variables.length==0)
					return false;

				if(variables[0].type==this.intype[i] || this.intype[i]=='?' || variables[0].type=='?')
					variables = variables.slice(1);
				else
					return false;
			}
		}
		if(variables.length>0)	//too many args supplied
			return false;
		else
			return true;
	};

	this.evaluate = options.evaluate || function(args,scope)
	{
		var nargs = [];
		for(var i=0; i<args.length; i++) {
			if(options.unwrapValues)
				nargs.push(jme.unwrapValue(args[i]));
			else
				nargs.push(args[i].value);
		}

		var result = this.fn.apply(null,nargs);

		if(options.unwrapValues) {
			result = jme.wrapValue(result);
			if(!result.type)
				result = new this.outcons(result);
		}
		else
			result = new this.outcons(result);

		if(options.latex) {
			result.latex = true;
		}

		return result;
	}	

	this.doc = options.doc;
}

/** The built-in JME evaluation scope
 * @type {Numbas.jme.Scope}
 * @memberof Numbas.jme
 */
var builtinScope = jme.builtinScope = new Scope();

builtinScope.functions['eval'] = [{
	name: 'eval',
	intype: ['?'],
	outtype: '?',
	typecheck: function(){return true;},
	doc: {
		usage: ['eval(x+2)'],
		description: 'Dummy function used by simplification rules to evaluate an expression.'
	}
}];

var funcs = {};

function newBuiltin(name,intype,outcons,fn,options) {
	return builtinScope.addFunction(new funcObj(name,intype,outcons,fn,options));
}

newBuiltin('+u', [TNum], TNum, function(a){return a;}, {doc: {usage: '+x', description: "Unary addition.", tags: ['plus','positive']}});	
newBuiltin('+u', [TVector], TVector, function(a){return a;}, {doc: {usage: '+x', description: "Vector unary addition.", tags: ['plus','positive']}});	
newBuiltin('+u', [TMatrix], TMatrix, function(a){return a;}, {doc: {usage: '+x', description: "Matrix unary addition.", tags: ['plus','positive']}});	
newBuiltin('-u', [TNum], TNum, math.negate, {doc: {usage: '-x', description: "Negation.", tags: ['minus','negative','negate']}});
newBuiltin('-u', [TVector], TVector, vectormath.negate, {doc: {usage: '-x', description: "Vector negation.", tags: ['minus','negative','negate']}});
newBuiltin('-u', [TMatrix], TMatrix, matrixmath.negate, {doc: {usage: '-x', description: "Matrix negation.", tags: ['minus','negative','negate']}});

newBuiltin('+', [TNum,TNum], TNum, math.add, {doc: {usage: 'x+y', description: "Add two numbers together.", tags: ['plus','add','addition']}});

newBuiltin('+', [TList,TList], TList, null, {
	evaluate: function(args,scope)
	{
		var value = args[0].value.concat(args[1].value);
		return new TList(value);
	},

	doc: {
		usage: ['list1+list2','[1,2,3]+[4,5,6]'],
		description: "Concatenate two lists.",
		tags: ['join','append','concatenation']
	}
});

newBuiltin('+',[TList,'?'],TList, null, {
	evaluate: function(args,scope)
	{
		var value = args[0].value.slice();
		value.push(args[1]);
		return new TList(value);
	},

	doc: {
		usage: ['list+3','[1,2] + 3'],
		description: "Add an item to a list",
		tags: ['push','append','insert']
	}
});

var fconc = function(a,b) { return a+b; }
newBuiltin('+', [TString,'?'], TString, fconc, {doc: {usage: '\'Hello \' + name', description: '_string_ + _anything else_ is string concatenation.', tags: ['concatenate','concatenation','add','join','strings','plus']}});
newBuiltin('+', ['?',TString], TString, fconc, {doc: {usage: 'name + \' is OK.\'', description: '_string_ + _anything else_ is string concatenation.', tags: ['concatenate','concatenation','add','join','strings','plus']}});

newBuiltin('+', [TVector,TVector], TVector, vectormath.add, {doc: {usage: 'vector(1,2) + vector(0,1)', description: 'Add two vectors.', tags: ['addition','plus']}});
newBuiltin('+', [TMatrix,TMatrix], TMatrix, matrixmath.add, {doc: {usage: 'matrix([1,0],[0,1]) + matrix([2,2],[2,2])', description: 'Add two matrices.', tags: ['addition','plus']}});
newBuiltin('-', [TNum,TNum], TNum, math.sub, {doc: {usage: ['x-y','2 - 1'], description: 'Subtract one number from another.', tags: ['minus','take away','subtraction']}});
newBuiltin('-', [TVector,TVector], TVector, vectormath.sub, {doc: {usage: 'vector(1,2) - vector(2,3)', description: 'Subtract one vector from another.', tags: ['subtraction','minus','take away']}});
newBuiltin('-', [TMatrix,TMatrix], TMatrix, matrixmath.sub, {doc: {usage: 'matrix([1,1],[2,3]) - matrix([3,3],[2,2])', description: 'Subtract one matrix from another.', tags: ['subtraction','minus','take away']}});
newBuiltin('*', [TNum,TNum], TNum, math.mul, {doc: {usage: ['3x','3*x','x*y','x*3'], description: 'Multiply two numbers.', tags: ['multiplication','compose','composition','times']}} );
newBuiltin('*', [TNum,TVector], TVector, vectormath.mul, {doc: {usage: '3*vector(1,2,3)', description: 'Multiply a vector on the left by a scalar.', tags: ['multiplication','composition','compose','times']}});
newBuiltin('*', [TVector,TNum], TVector, function(a,b){return vectormath.mul(b,a)}, {doc: {usage: 'vector(1,2,3) * 3', description: 'Multiply a vector on the right by a scalar.', tags: ['multiplication','composition','compose','times']}});
newBuiltin('*', [TMatrix,TVector], TVector, vectormath.matrixmul, {doc: {usage: 'matrix([1,0],[0,1]) * vector(1,2)', description: 'Multiply a matrix by a vector.', tags: ['multiplication','composition','compose','times']}});
newBuiltin('*', [TNum,TMatrix], TMatrix, matrixmath.scalarmul, {doc: {usage: '3*matrix([1,0],[0,1])', description: 'Multiply a matrix on the left by a scalar.', tags: ['multiplication','composition','compose','times']}} );
newBuiltin('*', [TMatrix,TNum], TMatrix, function(a,b){ return matrixmath.scalarmul(b,a); }, {doc: {usage: 'matrix([1,0],[1,2]) * 3', description: 'Multiply a matrix on the right by a scalar.', tags: ['multiplication','composition','compose','times']}} );
newBuiltin('*', [TMatrix,TMatrix], TMatrix, matrixmath.mul, {doc: {usage: 'matrix([1,0],[1,1]) * matrix([2,3],[3,4])', description: 'Multiply two matrices.', tags: ['multiplication','composition','compose','times']}});
newBuiltin('/', [TNum,TNum], TNum, math.div, {doc: {usage: ['x/y','3/2'], description: 'Divide two numbers.', tags: ['division','quotient','fraction']}} );
newBuiltin('/', [TMatrix,TNum], TMatrix, function(a,b){ return matrixmath.scalardiv(a,b); }, {doc: {usage: 'matrix([1,0],[1,2]) * 3', description: 'Multiply a matrix on the right by a scalar.', tags: ['multiplication','composition','compose','times']}} );
newBuiltin('/', [TVector,TNum], TVector, function(a,b){return vectormath.div(a,b)}, {doc: {usage: 'vector(1,2,3) * 3', description: 'Multiply a vector on the right by a scalar.', tags: ['multiplication','composition','compose','times']}});
newBuiltin('^', [TNum,TNum], TNum, math.pow, {doc: {usage: ['x^y','x^2','2^x','e^x'], description: 'Exponentiation.', tags: ['power','exponentiate','raise']}} );

newBuiltin('dot',[TVector,TVector],TNum,vectormath.dot, {doc: {usage: 'dot( vector(1,2,3), vector(2,3,4) )', description: 'Dot product of two vectors', tags: ['projection','project']}});
newBuiltin('dot',[TMatrix,TVector],TNum,vectormath.dot, {doc: {usage: 'dot( matrix([1],[2],[3]), vector(1,2,3) )', description: 'If the left operand is a matrix with one column, treat it as a vector, so we can calculate the dot product with another vector.', tags: ['projection','project']}});
newBuiltin('dot',[TVector,TMatrix],TNum,vectormath.dot, {doc: {usage: 'dot( vector(1,2,3), matrix([1],[2],[3]) )', description: 'If the right operand is a matrix with one column, treat it as a vector, so we can calculate the dot product with another vector.', tags: ['projection','project']}});
newBuiltin('dot',[TMatrix,TMatrix],TNum,vectormath.dot, {doc: {usage: 'dot( matrix([1],[2],[3]), matrix( [1],[2],[3] )', description: 'If both operands are matrices with one column, treat them as vectors, so we can calculate the dot product.', tags: ['projection','project']}});
newBuiltin('cross',[TVector,TVector],TVector,vectormath.cross, {doc: {usage: 'cross( vector(1,2,3), vector(1,2,3) )', description: 'Cross product of two vectors.'}});
newBuiltin('cross',[TMatrix,TVector],TVector,vectormath.cross, {doc: {usage: 'cross( matrix([1],[2],[3]), vector(1,2,3) )', description: 'If the left operand is a matrix with one column, treat it as a vector, so we can calculate the cross product with another vector.'}});
newBuiltin('cross',[TVector,TMatrix],TVector,vectormath.cross, {doc: {usage: 'cross( vector(1,2,3), matrix([1],[2],[3]) )', description: 'If the right operand is a matrix with one column, treat it as a vector, so we can calculate the crossproduct with another vector.'}});
newBuiltin('cross',[TMatrix,TMatrix],TVector,vectormath.cross, {doc: {usage: 'cross( matrix([1],[2],[3]), matrix([1],[2],[3]) )', description: 'If both operands are matrices with one column, treat them as vectors, so we can calculate the cross product with another vector.'}});
newBuiltin('det', [TMatrix], TNum, matrixmath.abs, {doc: {usage: 'det( matrix([1,2],[2,3]) )', description: 'Determinant of a matrix.'}});

newBuiltin('transpose',[TVector],TMatrix, vectormath.transpose, {doc: {usage: 'transpose( vector(1,2,3) )', description: 'Transpose of a vector.'}});
newBuiltin('transpose',[TMatrix],TMatrix, matrixmath.transpose, {doc: {usage: 'transpose( matrix([1,2,3],[4,5,6]) )', description: 'Transpose of a matrix.'}});

newBuiltin('id',[TNum],TMatrix, matrixmath.id, {doc: {usage: 'id(3)', description: 'Identity matrix with $n$ rows and columns.'}});

newBuiltin('..', [TNum,TNum], TRange, math.defineRange, {doc: {usage: ['a..b','1..2'], description: 'Define a range', tags: ['interval']}});
newBuiltin('#', [TRange,TNum], TRange, math.rangeSteps, {doc: {usage: ['a..b#c','0..1 # 0.1'], description: 'Set the step size for a range.'}}); 

newBuiltin('in',[TNum,TRange],TBool,function(x,r) {
	var start = r[0];
	var end = r[1];
	var step = r[2];
	var max_steps = Math.floor(end-start)/step;
	if(x>end) {
		return false;
	}
	var steps = Math.floor((x-start)/step);
	return step*steps+start==x && steps <= max_steps;
});

newBuiltin('html',[TString],THTML,function(html) { return $(html) }, {doc: {usage: ['html(\'<div>things</div>\')'], description: 'Parse HTML from a string', tags: ['element','node']}});
newBuiltin('image',[TString],THTML,function(url){ return $('<img/>').attr('src',url); }, {doc: {usage: ['image(\'picture.png\')'], description: 'Load an image from the given URL', tags: ['element','image','html']}});

newBuiltin('latex',[TString],TString,null,{
	evaluate: function(args,scope) {
		args[0].latex = true;
		return args[0];
	},
	doc: {
		usage: ['latex("something")'],
		description: 'Output a string as raw LaTeX. Normally, strings are wrapped in a \\textrm command.'
	}
});

newBuiltin('capitalise',[TString],TString,function(s) { return util.capitalise(s); }, {doc: {usage: ['capitalise(\'hello there\')'], description: 'Capitalise the first letter of a string', tags: ['upper-case','case','upper']}});
newBuiltin('upper',[TString],TString,function(s) { return s.toUpperCase(); }, {doc: {usage: ['upper(\'hello there\')'], description: 'Change all the letters in a string to capitals.', tags: ['upper-case','case','upper','capitalise','majuscule']}});
newBuiltin('lower',[TString],TString,function(s) { return s.toLowerCase(); }, {doc: {usage: ['lower(\'HELLO, you!\')'], description: 'Change all the letters in a string to minuscules.', tags: ['lower-case','lower','case']}});
newBuiltin('pluralise',[TNum,TString,TString],TString,function(n,singular,plural) { return util.pluralise(n,singular,plural); });
newBuiltin('join',[TList,TString],TString,function(list,delimiter) { return list.join(delimiter); },{unwrapValues:true});

//the next three versions of the `except` operator
//exclude numbers from a range, given either as a range, a list or a single value
newBuiltin('except', [TRange,TRange], TList,
	function(range,except) {
		if(range[2]==0)
			throw(new Numbas.Error("jme.func.except.continuous range"));
		range = range.slice(3);
		if(except[2]==0)
		{
			return range.filter(function(i){return i<except[0] || i>except[1]}).map(function(i){return new TNum(i)});
		}
		else
		{
			except = except.slice(3);
			return math.except(range,except).map(function(i){return new TNum(i)});
		}
	},

	{doc: {
		usage: '-9..9 except -1..1',
		description: 'Exclude a range of numbers from a larger range.',
		tags: ['except', 'exclude', 'filter', 'remove', 'numbers']
	}}
);

newBuiltin('except', [TRange,TList], TList,
	function(range,except) {
		if(range[2]==0)
			throw(new Numbas.Error("jme.func.except.continuous range"));
		range = range.slice(3);
		except = except.map(function(i){ return i.value; });
		return math.except(range,except).map(function(i){return new TNum(i)});
	},

	{doc: {
		usage: '-9..9 except [-1,1]',
		description: 'Exclude a list of numbers from a range.',
		tags: ['except', 'exclude', 'filter', 'remove', 'numbers']
	}}
);

newBuiltin('except', [TRange,TNum], TList,
	function(range,except) {
		if(range[2]==0)
			throw(new Numbas.Error("jme.func.except.continuous range"));
		range = range.slice(3);
		return math.except(range,[except]).map(function(i){return new TNum(i)});
	},

	{doc: {
		usage: '-9..9 except 0',
		description: 'Exclude a number from a range.',
		tags: ['except', 'exclude', 'filter', 'remove', 'numbers']
	}}
);

//exclude numbers from a list, so use the math.except function
newBuiltin('except', [TList,TRange], TList,
	function(range,except) {
		range = range.map(function(i){ return i.value; });
		except = except.slice(3);
		return math.except(range,except).map(function(i){return new TNum(i)});
	},

	{doc: {
		usage: '[1,4,9,16,25,36] except 10..30',
		description: 'Exclude a range of numbers from a list.',
		tags: ['except', 'exclude', 'filter', 'remove', 'numbers']
	}}
);

//exclude values of any type from a list containing values of any type, so use the util.except function
newBuiltin('except', [TList,TList], TList,
	function(list,except) {
		return util.except(list,except);
	},

	{doc: {
		usage: ["['a','b','c'] except ['b','d']",'[vector(0,1),vector(1,0),vector(1,1)] except [vector(1,1),vector(2,2)]'],
		description: 'Remove elements of the second list from the first.',
		tags: ['except', 'exclude', 'filter', 'remove']
	}}
);

newBuiltin('except',[TList,'?'], TList, null, {
	evaluate: function(args,scope) {
		return new TList(util.except(args[0].value,[args[1]]));
	},

  	doc: {
		usage: '[a,b,c,d] except b',
		description: 'Exclude a value from a list.',
		tags: ['except', 'exclude', 'filter', 'remove']
	}
});

newBuiltin('distinct',[TList],TList, util.distinct,{unwrapValues: false});

newBuiltin('in',['?',TList],TBool,null,{
	evaluate: function(args,scope) {
		return new TBool(util.contains(args[1].value,args[0]));
	}
});

newBuiltin('<', [TNum,TNum], TBool, math.lt, {doc: {usage: ['x<y','1<2'], description: 'Returns @true@ if the left operand is less than the right operand.', tags: ['comparison','inequality','numbers']}});
newBuiltin('>', [TNum,TNum], TBool, math.gt, {doc: {usage: ['x>y','2>1'], description: 'Returns @true@ if the left operand is greater than the right operand.', tags: ['comparison','inequality','numbers']}} );
newBuiltin('<=', [TNum,TNum], TBool, math.leq, {doc: {usage: ['x <= y','1<=1'], description: 'Returns @true@ if the left operand is less than or equal to the right operand.', tags: ['comparison','inequality','numbers']}} );
newBuiltin('>=', [TNum,TNum], TBool, math.geq, {doc: {usage: 'x >= y', description: 'Returns @true@ if the left operand is greater than or equal to the right operand.', tags: ['comparison','inequality','numbers']}} );
newBuiltin('<>', ['?','?'], TBool, null, {
	evaluate: function(args,scope) {
		return new TBool(util.neq(args[0],args[1]));
	},
	doc: {
		usage: ['\'this string\' <> \'that string\'', 'a <> b', '1<>2','sin(90)<>1'], 
		description: 'Inequality test.', 
		tags: ['comparison','not equal']
	}
});
newBuiltin('=', ['?','?'], TBool, null, {
	evaluate: function(args,scope) {
		return new TBool(util.eq(args[0],args[1]));
	},
	doc: {
		usage: ['x=y','vector(1,2)=vector(1,2,0)','0.1=0.2'], 
		description: 'Equality test.', 
		tags: ['comparison','same','identical']
	}
});

newBuiltin('and', [TBool,TBool], TBool, function(a,b){return a&&b;}, {doc: {usage: ['true && true','true and true'], description: 'Logical AND.'}} );
newBuiltin('not', [TBool], TBool, function(a){return !a;}, {doc: {usage: ['not x','!x'], description: 'Logical NOT.'}} );	
newBuiltin('or', [TBool,TBool], TBool, function(a,b){return a||b;}, {doc: {usage: ['x || y','x or y'], description: 'Logical OR.'}} );
newBuiltin('xor', [TBool,TBool], TBool, function(a,b){return (a || b) && !(a && b);}, {doc: {usage: 'a xor b', description: 'Logical XOR.', tags: ['exclusive or']}} );

newBuiltin('abs', [TNum], TNum, math.abs, {doc: {usage: 'abs(x)', description: 'Absolute value of a number.', tags: ['norm','length','complex']}} );
newBuiltin('abs', [TString], TNum, function(s){return s.length}, {doc: {usage: 'abs(x)', description: 'Absolute value of a number.', tags: ['norm','length','complex']}} );
newBuiltin('abs', [TList], TNum, function(l) { return l.length; }, {doc: {usage: 'abs([1,2,3])', description: 'Length of a list.', tags: ['size','number','elements']}});
newBuiltin('abs', [TRange], TNum, function(r) { return r[2]==0 ? Math.abs(r[0]-r[1]) : r.length-3; }, {doc: {usage: 'abs(1..5)', description: 'Number of elements in a numerical range.', tags: ['size','length']}});
newBuiltin('abs', [TVector], TNum, vectormath.abs, {doc: {usage: 'abs(vector(1,2,3))', description: 'Modulus of a vector.', tags: ['size','length','norm']}});
newBuiltin('arg', [TNum], TNum, math.arg, {doc: {usage: 'arg(1+i)', description: 'Argument of a complex number.', tags: ['angle','direction']}} );
newBuiltin('re', [TNum], TNum, math.re, {doc: {usage: 're(1 + 2i)', description: 'Real part of a complex number.'}} );
newBuiltin('im', [TNum], TNum, math.im, {doc: {usage: 'im(1 + 2i)', description: 'Imaginary part of a complex number.'}} );
newBuiltin('conj', [TNum], TNum, math.conjugate, {doc: {usage: 'conj(1 + 2i)', description: 'Conjugate of a complex number.'}} );

newBuiltin('isint',[TNum],TBool, function(a){ return util.isInt(a); }, {doc: {usage: 'isint(1)', description: 'Returns @true@ if the argument is an integer.', tags: ['test','whole number']}});

newBuiltin('sqrt', [TNum], TNum, math.sqrt, {doc: {usage: 'sqrt(x)', description: 'Square root.'}} );
newBuiltin('ln', [TNum], TNum, math.log, {doc: {usage: 'ln(x)', description: 'Natural logarithm.', tags: ['base e']}} );
newBuiltin('log', [TNum], TNum, math.log10, {doc: {usage: 'log(x)', description: 'Logarithm with base $10$.'}} );
newBuiltin('exp', [TNum], TNum, math.exp, {doc: {usage: 'exp(x)', description: 'Exponentiation. Equivalent to @e^x@. ', tags: ['exponential']}} );
newBuiltin('fact', [TNum], TNum, math.factorial, {doc: {usage: ['fact(x)','x!'], description: 'Factorial.', tags: ['!']}} );
newBuiltin('gamma', [TNum], TNum, math.gamma, {doc: {usage: ['fact(x)','x!'], description: 'Factorial.', tags: ['!']}} );
newBuiltin('sin', [TNum], TNum, math.sin, {doc: {usage: 'sin(x)', description: 'Sine.', tags: ['trigonometric','trigonometry']}} );
newBuiltin('cos', [TNum], TNum, math.cos, {doc: {usage: 'cos(x)', description: 'Cosine.', tags: ['trigonometric','trigonometry']}} );
newBuiltin('tan', [TNum], TNum, math.tan, {doc: {usage: 'tan(x)', description: 'Tangent.', tags: ['trigonometric','trigonometry']}} );
newBuiltin('cosec', [TNum], TNum, math.cosec, {doc: {usage: 'cosec(x)', description: 'Cosecant.', tags: ['trigonometric','trigonometry']}} );
newBuiltin('sec', [TNum], TNum, math.sec, {doc: {usage: 'sec(x)', description: 'Secant.', tags: ['trigonometric','trigonometry']}} );
newBuiltin('cot', [TNum], TNum, math.cot, {doc: {usage: 'cot(x)', description: 'Cotangent.', tags: ['trigonometric','trigonometry']}} );
newBuiltin('arcsin', [TNum], TNum, math.arcsin, {doc: {usage: 'arcsin(x)', description: 'Inverse sine.', tags: ['arcsine']}} );
newBuiltin('arccos', [TNum], TNum, math.arccos, {doc: {usage: 'arccos(x)', description: 'Inverse cosine.', tags: ['arccosine']}} );
newBuiltin('arctan', [TNum], TNum, math.arctan, {doc: {usage: 'arctan(x)', description: 'Inverse tangent.', tags: ['arctangent']}} );
newBuiltin('sinh', [TNum], TNum, math.sinh, {doc: {usage: 'sinh(x)', description: 'Hyperbolic sine.'}} );
newBuiltin('cosh', [TNum], TNum, math.cosh, {doc: {usage: 'cosh(x)', description: 'Hyperbolic cosine.'}} );
newBuiltin('tanh', [TNum], TNum, math.tanh, {doc: {usage: 'tanh(x)', description: 'Hyperbolic tangent.'}} );
newBuiltin('cosech', [TNum], TNum, math.cosech, {doc: {usage: 'cosech(x)', description: 'Hyperbolic cosecant.'}} );
newBuiltin('sech', [TNum], TNum, math.sech, {doc: {usage: 'sech(x)', description: 'Hyperbolic secant.'}} );
newBuiltin('coth', [TNum], TNum, math.coth, {doc: {usage: 'coth(x)', description: 'Hyperbolic cotangent.'}} );
newBuiltin('arcsinh', [TNum], TNum, math.arcsinh, {doc: {usage: 'arcsinh(x)', description: 'Inverse hyperbolic sine.'}} );
newBuiltin('arccosh', [TNum], TNum, math.arccosh, {doc: {usage: 'arccosh(x)', description: 'Inverse hyperbolic cosine.'}} );
newBuiltin('arctanh', [TNum], TNum, math.arctanh, {doc: {usage: 'arctanh(x)', description: 'Inverse hyperbolic tangent.'}} );
newBuiltin('ceil', [TNum], TNum, math.ceil, {doc: {usage: 'ceil(x)', description: 'Round up to nearest integer.', tags: ['ceiling']}} );
newBuiltin('floor', [TNum], TNum, math.floor, {doc: {usage: 'floor(x)', description: 'Round down to nearest integer.'}} );
newBuiltin('trunc', [TNum], TNum, math.trunc, {doc: {usage: 'trunc(x)', description: 'If the argument is positive, round down to the nearest integer; if it is negative, round up to the nearest integer.', tags: ['truncate','integer part']}} );
newBuiltin('fract', [TNum], TNum, math.fract, {doc: {usage: 'fract(x)', description: 'Fractional part of a number. Equivalent to @x-trunc(x)@.'}} );
newBuiltin('degrees', [TNum], TNum, math.degrees, {doc: {usage: 'degrees(pi/2)', description: 'Convert radians to degrees.'}} );
newBuiltin('radians', [TNum], TNum, math.radians, {doc: {usage: 'radians(90)', description: 'Convert degrees to radians.'}} );
newBuiltin('round', [TNum], TNum, math.round, {doc: {usage: 'round(x)', description: 'Round to nearest integer.', tags: ['whole number']}} );
newBuiltin('sign', [TNum], TNum, math.sign, {doc: {usage: 'sign(x)', description: 'Sign of a number. Equivalent to $\\frac{x}{|x|}$, or $0$ when $x=0$.', tags: ['positive','negative']}} );

newBuiltin('factorise',[TNum],TList,function(n) {
		return math.factorise(n).map(function(n){return new TNum(n)});
	}
);

newBuiltin('random', [TRange], TNum, math.random, {doc: {usage: 'random(1..4)', description: 'A random number in the given range.', tags: ['choose','pick']}} );

newBuiltin('random',[TList],'?',null, {
	evaluate: function(args,scope) 
	{
		return math.choose(args[0].value);
	},

	doc: {
		usage: 'random([1,1,2,3,5])',
		description: 'Choose a random item from a list.',
		tags: ['pick','select']
	}
});

newBuiltin( 'random',[],'?', null, {
	typecheck: function() { return true; },
	evaluate: function(args,scope) { return math.choose(args);},
	doc: {
		usage: 'random(1,2,3,4,5)',
		description: 'Choose at random from the given arguments.',
		tags: ['pick','select']
	}
});

newBuiltin('mod', [TNum,TNum], TNum, math.mod, {doc: {usage: 'mod(a,b)', description: 'Modulus, i.e. $a \\bmod{b}.$', tags: ['remainder','modulo']}} );
newBuiltin('max', [TNum,TNum], TNum, math.max, {doc: {usage: 'max(x,y)', description: 'Maximum of two numbers.', tags: ['supremum','biggest','largest','greatest']}} );
newBuiltin('min', [TNum,TNum], TNum, math.min, {doc: {usage: 'min(x,y)', description: 'Minimum of two numbers.', tags: ['smallest','least']}} );
newBuiltin('max', [TList], TNum, math.listmax, {unwrapValues: true});
newBuiltin('min', [TList], TNum, math.listmin, {unwrapValues: true});
newBuiltin('precround', [TNum,TNum], TNum, math.precround, {doc: {usage: 'precround(x,3)', description: 'Round to given number of decimal places.', tags: ['dp']}} );
newBuiltin('precround', [TMatrix,TNum], TMatrix, matrixmath.precround, {doc: {usage: 'precround(x,3)', description: 'Round to given number of decimal places.', tags: ['dp']}} );
newBuiltin('siground', [TNum,TNum], TNum, math.siground, {doc: {usage: 'siground(x,3)', description: 'Round to given number of significant figures.', tags: ['sig figs','sigfig']}} );
newBuiltin('siground', [TMatrix,TNum], TMatrix, matrixmath.siground, {doc: {usage: 'precround(x,3)', description: 'Round to given number of decimal places.', tags: ['dp']}} );
newBuiltin('dpformat', [TNum,TNum], TString, function(n,p) {return math.niceNumber(n,{precisionType: 'dp', precision:p});}, {doc: {usage: 'dpformat(x,3)', description: 'Round to given number of decimal points and pad with zeroes if necessary.', tags: ['dp','decimal points','format','display','precision']}} );
newBuiltin('sigformat', [TNum,TNum], TString, function(n,p) {return math.niceNumber(n,{precisionType: 'sigfig', precision:p});}, {doc: {usage: 'dpformat(x,3)', description: 'Round to given number of significant figures and pad with zeroes if necessary.', tags: ['sig figs','sigfig','format','display','precision']}} );
newBuiltin('perm', [TNum,TNum], TNum, math.permutations, {doc: {usage: 'perm(6,3)', description: 'Count permutations. $^n \\kern-2pt P_r$.', tags: ['combinatorics']}} );
newBuiltin('comb', [TNum,TNum], TNum, math.combinations , {doc: {usage: 'comb(6,3)', description: 'Count combinations. $^n \\kern-2pt C_r$.', tags: ['combinatorics']}});
newBuiltin('root', [TNum,TNum], TNum, math.root, {doc: {usage: ['root(8,3)','root(x,n)'], description: '$n$<sup>th</sup> root.', tags: ['cube']}} );
newBuiltin('award', [TNum,TBool], TNum, function(a,b){return (b?a:0);}, {doc: {usage: ['award(a,b)','award(5,x=y)'], description: 'If @b@ is @true@, returns @a@, otherwise returns @0@.', tags: ['mark']}} );
newBuiltin('gcd', [TNum,TNum], TNum, math.gcf, {doc: {usage: 'gcd(a,b)', description: 'Greatest common denominator of two integers.', tags: ['highest']}} );
newBuiltin('gcd_without_pi_or_i', [TNum,TNum], TNum, function(a,b) {	// take out factors of pi or i before working out gcd. Used by the fraction simplification rules
		if(a.complex && a.re==0) {
			a = a.im;
		}
		if(b.complex && b.re==0) {
			b = b.im;
		}
		a = a/math.pow(Math.PI,math.piDegree(a));
		b = b/math.pow(Math.PI,math.piDegree(b));
		return math.gcf(a,b);
} );
newBuiltin('lcm', [TNum,TNum], TNum, math.lcm, {doc: {usage: 'lcm(a,b)', description: 'Lowest common multiple of two integers.', tags: ['least']}} );
newBuiltin('lcm', [TList], TNum, function(l){ 
		if(l.length==0) {
			return 1;
		} else if(l.length==1) {
			return l[0];
		} else {
			return math.lcm.apply(math,l);
		}
	},
	{unwrapValues: true, doc: {usage: 'lcm(a,b)', description: 'Lowest common multiple of two integers.', tags: ['least']}} 
);
newBuiltin('|', [TNum,TNum], TBool, math.divides, {doc: {usage: 'x|y', description: 'Returns @true@ if @x@ divides @y@.', tags: ['multiple of']}} );

newBuiltin('diff', ['?','?',TNum], '?', null, {doc: {usage: ['diff(f(x),x,n)', 'diff(x^2,x,1)','diff(y,x,1)'], description: '$n$<sup>th</sup> derivative. Currently for display only - can\'t be evaluated.', tags: ['differentiate','differential','differentiation']}});
newBuiltin('pdiff', ['?',TName,TNum], '?', null, {doc: {usage: ['pdiff(f(x,y),x,n)','pdiff(x+y,x,1)'], description: '$n$<sup>th</sup> partial derivative. Currently for display only - can\'t be evaluated.', tags: ['differentiate','differential','differentiation']}});
newBuiltin('int', ['?','?'], '?', null, {doc: {usage: 'int(f(x),x)', description: 'Integral. Currently for display only - can\'t be evaluated.'}});
newBuiltin('defint', ['?','?',TNum,TNum], '?', null, {doc: {usage: 'defint(f(x),y,0,1)', description: 'Definite integral. Currently for display only - can\'t be evaluated.'}});

newBuiltin('sum',[TList],TNum,function(list) {
	var total = 0;
	var l = list.length;

	if(l==0) {
		return 0;
	}

	for(var i=0;i<l;i++) {
		total = math.add(total,list[i].value);
	}
	
	return total;
});

newBuiltin('deal',[TNum],TList, 
	function(n) {
		return math.deal(n).map(function(i) {
			return new TNum(i);
		});
	},
	{doc: {
		usage: ['deal(n)','deal(5)'],
		description: 'A random shuffling of the integers $[0 \\dots n-1]$.',
		tags: ['permutation','order','shuffle']
	}}
);

newBuiltin('shuffle',[TList],TList,
	function(list) {
		return math.shuffle(list);
	},
	{doc: {
		usage: ['shuffle(list)','shuffle([1,2,3])'],
		description: 'Randomly reorder a list.',
		tags: ['permutation','order','shuffle','deal']	
	}}
);

//if needs to be a bit different because it can return any type
newBuiltin('if', [TBool,'?','?'], '?',null, {
	evaluate: function(args,scope)
	{
		var test = jme.evaluate(args[0],scope).value;

		if(test)
			return jme.evaluate(args[1],scope);
		else
			return jme.evaluate(args[2],scope);
	},

	doc: {
		usage: 'if(test,a,b)',
		description: 'If @test@ is true, return @a@, otherwise return @b@.',
		tags: ['test','decide']
	}
});

newBuiltin('switch',[],'?', null, {
	typecheck: function(variables)
	{
		//should take alternating booleans and [any value]
		//final odd-numbered argument is the 'otherwise' option
		if(variables.length <2)
			return false;

		var check=0;
		if(variables.length % 2 == 0)
			check = variables.length;
		else
			check = variables.length-1;

		for( var i=0; i<check; i+=2 )
		{
			switch(variables[i].tok.type)
			{
			case '?':
			case 'boolean':
				break;
			default:
				return false;
			}
		}
		return true;
	},
	evaluate: function(args,scope)
	{
		for(var i=0; i<args.length-1; i+=2 )
		{
			var result = jme.evaluate(args[i],scope).value;
			if(result)
				return jme.evaluate(args[i+1],scope);
		}
		if(args.length % 2 == 1)
			return jme.evaluate(args[args.length-1],scope);
		else
			throw(new Numbas.Error('jme.func.switch.no default case'));
	},

	doc: {
		usage: 'switch(test1,a1,test2,a2,b)',
		description: 'Select cases. Alternating boolean expressions with values to return, with the final argument representing the default case.',
		tags: ['choose','test']
	}
});

newBuiltin('isa',['?',TString],TBool, null, {
	evaluate: function(args,scope)
	{
		var kind = jme.evaluate(args[1],scope).value;
		if(args[0].tok.type=='name' && scope.variables[args[0].tok.name.toLowerCase()]==undefined )
			return new TBool(kind=='name');

		var match = false;
		if(kind=='complex')
		{
			match = args[0].tok.type=='number' && args[0].tok.value.complex || false;
		}
		else
		{
			match = args[0].tok.type == kind;
		}
		return new TBool(match);
	},

	doc: {
		usage: 'x isa \'number\'',
		description: 'Determine the data-type of an expression.',
		tags: ['typeof','test','is a']
	}
});

// repeat(expr,n) evaluates expr n times and returns a list of the results
newBuiltin('repeat',['?',TNum],TList, null, {
	evaluate: function(args,scope)
	{
		var size = jme.evaluate(args[1],scope).value;
		var value = [];
		for(var i=0;i<size;i++)
		{
			value[i] = jme.evaluate(args[0],scope);
		}
		return new TList(value);
	},

	doc: {
		usage: ['repeat(expr,n)','repeat( random(1..3), 5)'],
		description: 'Evaluate the given expression $n$ times, returning the results in a list.'
	}
});

function satisfy(names,definitions,conditions,scope,maxRuns) {
		maxRuns = maxRuns===undefined ? 100 : maxRuns;
		if(definitions.length!=names.length) {
			throw(new Numbas.Error('jme.func.satisfy.wrong number of definitions'));
		}

		var satisfied = false;
		var runs = 0;
		while(runs<maxRuns && !satisfied) {
			runs += 1;

			var variables = {};
			for(var i=0; i<names.length; i++) {
				variables[names[i]] = jme.evaluate(definitions[i],scope);
			}
			var nscope = new jme.Scope([scope,{variables:variables}]);
			satisfied = true;
			for(var i=0; i<conditions.length; i++) {
				var ok = jme.evaluate(conditions[i],nscope);
				if(ok.type!='boolean') {
					throw(new Numbas.Error('jme.func.satisfy.condition not a boolean'));
				}
				if(!ok.value) {
					satisfied = false;
					break;
				}
			}
		}
		if(!satisfied) {
			throw(new Numbas.Error('jme.func.satisfy.took too many runs'));
		}

		return variables;
}

newBuiltin('satisfy', [TList,TList,TList,TNum], TList, null, {
	evaluate: function(args,scope)
	{
		var names = args[0].args.map(function(t){ return t.tok.name; });
		var definitions = args[1].args;
		var conditions = args[2].args;
		var maxRuns = args.length>3 ? jme.evaluate(args[3]).value : 100;
		
		var variables = satisfy(names,definitions,conditions,scope,maxRuns);

		return new TList(names.map(function(name){ return variables[name]; }));
	}
});

newBuiltin('listval',[TList,TNum],'?', null, {
	evaluate: function(args,scope)
	{
		var list = args[0];
		var index = util.wrapListIndex(args[1].value,list.vars);
		if(list.type!='list') {
			if(list.type=='name')
				throw(new Numbas.Error('jme.variables.variable not defined',list.name));
			else
				throw(new Numbas.Error('jme.func.listval.not a list'));
		}
		if(index in list.value)
			return list.value[index];
		else
			throw(new Numbas.Error('jme.func.listval.invalid index',index,list.value.length));
	},

	doc: {
		usage: ['list[i]','[0,1,2,3][2]'],
		description: 'Return a particular element of a list.',
		tags: ['index','item','access']
	}
});

newBuiltin('listval',[TList,TRange],TList, null, {
	evaluate: function(args,scope)
	{
		var range = args[1].value;
		var list = args[0];
		var size = list.vars;
		var start = util.wrapListIndex(range[0],size);
		var end = util.wrapListIndex(range[1]),size;
		var value = list.value.slice(start,end);
		return new TList(value);
	},

	doc: {
		usage: ['list[1..3]','[0,1,2,3,4][1..3]'],
		description: 'Slice a list - return the elements with indices in the given range.',
		tags: ['range','section','part']
	}
});

newBuiltin('listval',[TVector,TNum],TNum, null, {
	evaluate: function(args,scope)
	{
		var vector = args[0].value;
		var index = util.wrapListIndex(args[1].value,vector.length);
		return new TNum(vector[index] || 0);
	},

	doc: {
		usage: ['vec[1]','vector(0,1,2)[1]'],
		description: 'Return a particular component of a vector.',
		tags: ['index','item','access']
	}
});

newBuiltin('listval',[TVector,TRange],TVector,null, {
	evaluate: function(args,scope)
	{
		var range = args[1].value;
		var vector = args[0].value;
		var start = util.wrapListIndex(range[0],vector.length);
		var end = util.wrapListIndex(range[1],vector.length);
		var v = [];
		for(var i=start;i<end;i++) {
			v.push(vector[i] || 0);
		}
		return new TVector(v);
	}
});

newBuiltin('listval',[TMatrix,TNum],TVector, null, {
	evaluate: function(args,scope)
	{
		var matrix = args[0].value;
		var index = util.wrapListIndex(args[1].value,matrix.length);
		return new TVector(matrix[index] || []);
	},

	doc: {
		usage: ['mat[1]','matrix([1,0],[0,1])[1]'],
		description: 'Return a particular row of a matrix.',
		tags: ['index','item','access','element','cell']
	}
});

newBuiltin('listval',[TMatrix,TRange],TMatrix,null, {
	evaluate: function(args,scope)
	{
		var range = args[1].value;
		var matrix = args[0].value;
		var start = util.wrapListIndex(range[0],matrix.length);
		var end = util.wrapListIndex(range[1],matrix.length);
		var v = [];
		return new TMatrix(matrix.slice(start,end));
	}
});

newBuiltin('map',['?',TName,'?'],TList, null, {
	evaluate: function(args,scope)
	{
		var lambda = args[0];

		var list = jme.evaluate(args[2],scope);
		switch(list.type) {
		case 'list':
		case 'set':
			list = list.value;
			break;
		case 'range':
			list = list.value.slice(3);
			for(var i=0;i<list.length;i++) {
				list[i] = new TNum(list[i]);
			}
			break;
		default:
			throw(new Numbas.Error('jme.typecheck.map not on enumerable',list.type));
		}
		var value = [];
		scope = new Scope(scope);

		var names_tok = args[1].tok;
		if(names_tok.type=='name') {
			var name = names_tok.name;
			for(var i=0;i<list.length;i++)
			{
				scope.variables[name] = list[i];
				value[i] = jme.evaluate(lambda,scope);
			}
		} else if(names_tok.type=='list') {
			var names = args[1].args.map(function(t){return t.tok.name;});
			for(var i=0;i<list.length;i++)
			{
				names.map(function(name,j) {
					scope.variables[name] = list[i].value[j];
				});
				value[i] = jme.evaluate(lambda,scope);
			}
		}
		return new TList(value);
	},
	
	doc: {
		usage: ['map(expr,x,list)','map(x^2,x,[0,2,4,6])'],
		description: 'Apply the given expression to every value in a list.'
	}
});

newBuiltin('map',['?',TList,'?'],TList,null, {
	evaluate: function(args,scope)
	{
		var list = jme.evaluate(args[2],scope);
		switch(list.type) {
		case 'list':
			list = list.value;
			break;
		case 'range':
			list = list.value.slice(3);
			for(var i=0;i<list.length;i++) {
				list[i] = new TNum(list[i]);
			}
			break;
		default:
			throw(new Numbas.Error('jme.typecheck.map not on enumerable',list.type));
		}
		var value = [];
		var names = args[1].tok.args.map(function(t){return t.tok.name;});
		scope = new Scope(scope);
		for(var i=0;i<list.length;i++)
		{
			names.map(function(name,j) {
				console.log(name,list[i].value[j]);
				scope.variables[name] = list[i].value[j];
			});
			scope.variables[name] = list[i];
			value[i] = jme.evaluate(args[0],scope);
		}
		return new TList(value);
	}
});

newBuiltin('sort',[TList],TList, null, {
	evaluate: function(args,scope)
	{
		var list = args[0];
		var newlist = new TList(list.vars);
		newlist.value = list.value.slice().sort(function(a,b){ 
			if(math.gt(a.value,b.value))
				return 1;
			else if(math.lt(a.value,b.value))
				return -1;
			else
				return 0;
		});
		return newlist;
	},

	doc: {
		usage: 'sort(list)',
		description: 'Sort a list.'
	}
});

newBuiltin('set',[TList],TSet,function(l) {
	return util.distinct(l);
});
newBuiltin('set',[TRange],TSet,function(r) {
	return r.slice(3).map(function(n){return new TNum(n)});
});

newBuiltin('set', ['?'], TSet, null, {
	evaluate: function(args,scope) {
		return new TSet(util.distinct(args));
	},
	typecheck: function() {
		return true;
	}

});
newBuiltin('list',[TSet],TList,function(set) {
	var l = [];
	for(i=0;i<set.length;i++) {
		l.push(set[i]);
	}
	return l;
});

newBuiltin('union',[TSet,TSet],TSet,setmath.union);
newBuiltin('intersection',[TSet,TSet],TSet,setmath.intersection);
newBuiltin('or',[TSet,TSet],TSet,setmath.union);
newBuiltin('and',[TSet,TSet],TSet,setmath.intersection);
newBuiltin('-',[TSet,TSet],TSet,setmath.minus);

newBuiltin('in',['?',TSet],TBool,null,{
	evaluate: function(args,scope) {
		return new TBool(util.contains(args[1].value,args[0]));
	}
});

newBuiltin('product',['?'],TList,function() {
	var lists = Array.prototype.slice.call(arguments);
	var prod = util.product(lists);
	return prod.map(function(l){ return new TList(l); });
}, {
	typecheck: function(variables) {
		for(var i=0;i<variables.length;i++) {
			var t = variables[i].type;
			if(!(t=='list' || t=='set')) {
				return false;
			}
		}
		return true;
	}
});

newBuiltin('combinations',['?',TNum],TList,function(list,r) {
	var prod = util.combinations(list,r);
	return prod.map(function(l){ return new TList(l); });
}, {
	typecheck: function(variables) {
		return (variables[0].type=='set' || variables[0].type=='list') && variables[1].type=='number';
	}
});

newBuiltin('combinations_with_replacement',['?',TNum],TList,function(list,r) {
	var prod = util.combinations_with_replacement(list,r);
	return prod.map(function(l){ return new TList(l); });
}, {
	typecheck: function(variables) {
		return (variables[0].type=='set' || variables[0].type=='list') && variables[1].type=='number';
	}
});

newBuiltin('permutations',['?',TNum],TList,function(list,r) {
	var prod = util.permutations(list,r);
	return prod.map(function(l){ return new TList(l); });
}, {
	typecheck: function(variables) {
		return (variables[0].type=='set' || variables[0].type=='list') && variables[1].type=='number';
	}
});

newBuiltin('vector',['*TNum'],TVector, null, {
	evaluate: function(args,scope)
	{
		var value = [];
		for(var i=0;i<args.length;i++)
		{
			value.push(args[i].value);
		}
		return new TVector(value);
	},

	doc: {
		usage: ['vector(1,2,3)','vector(a,b)'],
		description: 'Create a vector with the given components.',
		tags: ['constructor','new']
	}
});

newBuiltin('vector',[TList],TVector, null, {
	evaluate: function(args,scope)
	{
		var list = args[0];
		var value = list.value.map(function(x){return x.value});
		return new TVector(value);
	},

	doc: {
		usage: ['vector([1,2,3])','vector(list)'],
		description: 'Create a vector from a list of numbers.',
		tags: ['constructor','new','convert','cast']
	}
});

newBuiltin('matrix',[TList],TMatrix,null, {
	evaluate: function(args,scope)
	{
		var list = args[0];
		var rows = list.vars;
		var columns = 0;
		var value = [];
		switch(list.value[0].type)
		{
		case 'number':
			value = [list.value.map(function(e){return e.value})];
			rows = 1;
			columns = list.vars;
			break;
		case 'vector':
			value = list.value.map(function(v){return v.value});
			columns = list.value[0].value.length;
			break;
		case 'list':
			for(var i=0;i<rows;i++)
			{
				var row = list.value[i].value;
				value.push(row.map(function(x){return x.value}));
				columns = Math.max(columns,row.length);
			}
			break;
		default:
			throw(new Numbas.Error('jme.func.matrix.invalid row type',list.value[0].type));
		}
		value.rows = rows;
		value.columns = columns;
		return new TMatrix(value);
	},

	doc: {
		usage: ['matrix([ [1,2], [3,4] ])', 'matrix([ row1, row2 ])'],
		tags: ['convert','cast','constructor','new'],
		description: 'Create a matrix from a list of rows. This constructor is useful if the number of rows is not a constant.'
	}
});

newBuiltin('matrix',['*list'],TMatrix, null, {
	evaluate: function(args,scope)
	{
		var rows = args.length;
		var columns = 0;
		var value = [];
		for(var i=0;i<args.length;i++)
		{
			var row = args[i].value;
			value.push(row.map(function(x){return x.value}));
			columns = Math.max(columns,row.length);
		}
		value.rows = rows;
		value.columns = columns;
		return new TMatrix(value);
	},

	doc: {
		usage: ['matrix([1,0],[0,1])','matrix(row1,row2,row3)'],
		description: 'Create a matrix. The arguments are lists of numbers, representing the rows.',
		tags: ['constructor', 'new']
	}
});

newBuiltin('rowvector',['*number'],TMatrix, null, {
	evaluate: function(args,scope)
	{
		var row = [];
		for(var i=0;i<args.length;i++)
		{
			row.push(args[i].value);
		}
		var matrix = [row];
		matrix.rows = 1;
		matrix.columns = row.length;
		return new TMatrix(matrix);
	},

	doc: {
		usage: 'rowvector(1,2,3)',
		description: 'Create a row vector, i.e. an $n \\times 1$ matrix, with the given components.',
		tags: ['constructor','new']
	}
});

newBuiltin('rowvector',[TList],TMatrix, null, {
	evaluate: function(args,scope)
	{
		var list = args[0];
		var row = list.value.map(function(x){return x.value});
		var matrix = [row];
		matrix.rows = 1;
		matrix.columns = row.length;
		return new TMatrix(matrix);
	},

	doc: {
		usage: 'rowvector(1,2,3)',
		description: 'Create a row vector, i.e. an $n \\times 1$ matrix, with the given components.',
		tags: ['constructor','new']
	}
});

//cast vector to list
newBuiltin('list',[TVector],TList,null, {
	evaluate: function(args,scope)
	{
		var vector = args[0];
		var value = vector.value.map(function(n){ return new TNum(n)});
		return new TList(value);
	},

	doc: {
		usage: ['list(vector(0,1,2))','list(vector)'],
		description: 'Cast a vector to a list.',
		tags: ['convert']
	}
});

//cast matrix to list of lists
newBuiltin('list',[TMatrix],TList,null, {
	evaluate: function(args,scope)
	{
		var matrix = args[0];
		var value = [];
		for(var i=0;i<matrix.value.rows;i++)
		{
			var row = new TList(matrix.value[i].map(function(n){return new TNum(n)}));
			value.push(row);
		}
		return new TList(value);
	},

	doc: {
		usage: ['list(matrix([0,1],[2,3]))'],
		tags: ['convert','cast'],
		description: 'Cast a matrix to a list of its rows.'
	}
});

newBuiltin('table',[TList,TList],THTML,
	function(data,headers) {
		var table = $('<table/>');

		var thead = $('<thead/>');
		table.append(thead);
		for(var i=0;i<headers.length;i++) {
			var cell = headers[i];
			if(typeof cell=='number')
				cell = Numbas.math.niceNumber(cell);
			thead.append($('<th/>').html(cell));
		}

		var tbody=$('<tbody/>');
		table.append(tbody);
		for(var i=0;i<data.length;i++) {
			var row = $('<tr/>');
			tbody.append(row);
			for(var j=0;j<data[i].length;j++) {
				var cell = data[i][j];
				if(typeof cell=='number')
					cell = Numbas.math.niceNumber(cell);
				row.append($('<td/>').html(cell));
			}
		}

		return table;
	},
	{
		unwrapValues: true,

		doc: {
			usage: ['table([ [1,2,3], [4,5,6] ], [\'Header 1\', \'Header 2\'])', 'table(data,headers)'],
			tags: ['table','tabular','data','html'],
			description: 'Create a table to display a list of rows of data, with the given headers.'
		}
	}
);

///end of builtins



function randoms(varnames,min,max,times)
{
	times *= varnames.length;
	var rs = [];
	for( var i=0; i<times; i++ )
	{
		var r = {};
		for( var j=0; j<varnames.length; j++ )
		{
			r[varnames[j]] = new TNum(Numbas.math.randomrange(min,max));
		}
		rs.push(r);
	}
	return rs;
}


function varnamesAgree(array1, array2) {
	var name;
	for(var i=0; i<array1.length; i++) {
		if( (name=array1[i])[0]!='$' && !array2.contains(name) )
			return false;
	}
	
	return true;
};

/** 
 * Numerical comparison functions
 * @enum {function}
 * @memberof Numbas.jme 
 */
var checkingFunctions = 
{
	/** Absolute difference between variables - fail if bigger than tolerance */
	absdiff: function(r1,r2,tolerance) 
	{
		if(r1===Infinity || r1===-Infinity)
			return r1===r2;

		return math.leq(math.abs(math.sub(r1,r2)), Math.abs(tolerance));
	},

	/** Relative (proportional) difference between variables - fail if `r1/r2 - 1` is bigger than tolerance */
	reldiff: function(r1,r2,tolerance) {
		if(r1===Infinity || r1===-Infinity)
			return r1===r2;

		// 
		if(r2!=0) {
			return math.leq(Math.abs(math.sub(r1,r2)), Math.abs(math.mul(tolerance,r2)));
		} else {	//or if correct answer is 0, checks abs difference
			return math.leq(Math.abs(math.sub(r1,r2)), tolerance);
		}
	},

	/** Round both values to given number of decimal places, and fail if unequal. */
	dp: function(r1,r2,tolerance) {
		if(r1===Infinity || r1===-Infinity)
			return r1===r2;

		tolerance = Math.floor(Math.abs(tolerance));
		return math.eq( math.precround(r1,tolerance), math.precround(r2,tolerance) );
	},

	/** Round both values to given number of significant figures, and fail if unequal. */
	sigfig: function(r1,r2,tolerance) {
		if(r1===Infinity || r1===-Infinity)
			return r1===r2;

		tolerance = Math.floor(Math.abs(tolerance));
		return math.eq(math.siground(r1,tolerance), math.siground(r2,tolerance));
	}
};

/** Custom findvars behaviour for specific functions - for a given usage of a function, work out which variables it depends on.
 * 
 * Functions have the signature <tree with function call at top, list of bound variable names, scope>.
 *
 * tree.args is a list of the function's arguments.
 *
 * @memberof Numbas.jme
 * @enum {function}
 * @see Numbas.jme.findvars
 */
var findvarsOps = jme.findvarsOps = {
	'map': function(tree,boundvars,scope) {
		boundvars = boundvars.slice();
		boundvars.push(tree.args[1].tok.name.toLowerCase());
		var vars = findvars(tree.args[0],boundvars,scope);
		vars = vars.merge(findvars(tree.args[2],boundvars));
		return vars;
	},
	'satisfy': function(tree,boundvars,scope) {
		var names = tree.args[0].args.map(function(t){return t.tok.name});
		boundvars = boundvars.concat(0,0,names);
		var vars = [];
		for(var i=1;i<tree.args.length;i++)
			vars = vars.merge(findvars(tree.args[i],boundvars));
		return vars;
	}
}

/** Find all variables used in given syntax tree
 * @memberof Numbas.jme
 * @method
 * @param {Numbas.jme.tree} tree
 * @param {string[]} boundvars - variables to be considered as bound (don't include them)
 * @param {Numbas.jme.Scope} scope
 * @returns {string[]}
 */
var findvars = jme.findvars = function(tree,boundvars,scope)
{
	if(!scope)
		scope = jme.builtinScope;
	if(boundvars===undefined)
		boundvars = [];

	if(tree.tok.type=='function' && tree.tok.name in findvarsOps) {
		return findvarsOps[tree.tok.name](tree,boundvars,scope);
	}

	if(tree.args===undefined)
	{
		switch(tree.tok.type)
		{
		case 'name':
			var name = tree.tok.name.toLowerCase();
			if(boundvars.indexOf(name)==-1)
				return [name];
			else
				return [];
			break;
		case 'string':
			var bits = jme.texsplit(tree.tok.value);
			var out = [];
			for(var i=0;i<bits.length-3;i+=4)
			{
				var cmd = bits[i+1];
				var expr = bits[i+3];
				switch(cmd)
				{
				case 'var':
					var tree2 = jme.compile(expr,scope,true);
					out = out.merge(findvars(tree2,boundvars));
					break;
				case 'simplify':
					var sbits = util.splitbrackets(expr,'{','}');
					for(var i=1;i<sbits.length-1;i+=2)
					{
						var tree2 = jme.compile(sbits[i],scope,true);
						out = out.merge(findvars(tree2,boundvars));
					}
					break;
				}
			}
			return out;
		default:
			return [];
		}
	}
	else
	{
		var vars = [];
		for(var i=0;i<tree.args.length;i++)
			vars = vars.merge(findvars(tree.args[i],boundvars));
		return vars;
	}
}

/** Check that two values are equal 
 * @memberof Numbas.jme
 * @method
 * @param {Numbas.jme.token} r1
 * @param {Numbas.jme.token} r2
 * @param {function} checkingFunction - one of {@link Numbas.jme.checkingFunctions}
 * @param {number} checkingAccuracy
 * @returns {boolean}
 */
function resultsEqual(r1,r2,checkingFunction,checkingAccuracy)
{	// first checks both expressions are of same type, then uses given checking type to compare results

	var v1 = r1.value, v2 = r2.value;

	if(r1.type != r2.type)
	{
		return false;
	}
	switch(r1.type)
	{
	case 'number':
		if(v1.complex || v2.complex)
		{
			if(!v1.complex)
				v1 = {re:v1, im:0, complex:true};
			if(!v2.complex)
				v2 = {re:v2, im:0, complex:true};
			return checkingFunction(v1.re, v2.re, checkingAccuracy) && checkingFunction(v1.im,v2.im,checkingAccuracy);
		}
		else
		{
			return checkingFunction( v1, v2, checkingAccuracy );
		}
		break;
	case 'vector':
		if(v1.length != v2.length)
			return false;
		for(var i=0;i<v1.length;i++)
		{
			if(!resultsEqual(new TNum(v1[i]),new TNum(v2[i]),checkingFunction,checkingAccuracy))
				return false;
		}
		return true;
		break;
	case 'matrix':
		if(v1.rows != v2.rows || v1.columns != v2.columns)
			return false;
		for(var i=0;i<v1.rows;i++)
		{
			for(var j=0;j<v1.columns;j++)
			{
				if(!resultsEqual(new TNum(v1[i][j]||0),new TNum(v2[i][j]||0),checkingFunction,checkingAccuracy))
					return false;
			}
		}
		return true;
		break;
	case 'list':
		if(v1.length != v2.length)
			return false;
		for(var i=0;i<v1.length;i++)
		{
			if(!resultsEqual(v1[i],v2[i],checkingFunction,checkingAccuracy))
				return false;
		}
		return true;
	default:
		return util.eq(r1,r2);
	}
};

});

/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/** @file Stuff to do with displaying JME expressions - convert to TeX, simplify, or convert syntax trees back to JME 
 *
 * Provides {@link Numbas.jme.display}
 */

Numbas.queueScript('jme-display',['base','math','jme','util'],function() {
	
var math = Numbas.math;
var jme = Numbas.jme;
var util = Numbas.util;

/** A JME expression
 * @typedef JME
 * @type {string}
 */

/** A LaTeX string
 * @typedef TeX
 * @type {string}
 */

/** @namespace Numbas.jme.display */

jme.display = /** @lends Numbas.jme.display */ {
	/** Convert a JME expression to LaTeX.
	 *
	 * @param {JME} expr
	 * @param {string[]|Numbas.jme.Ruleset} ruleset - can be anything accepted by {@link Numbas.jme.display.collectRuleset}
	 * @param {Numbas.jme.Scope} scope
	 * @returns {TeX}
	 */
	exprToLaTeX: function(expr,ruleset,scope)
	{
		if(!ruleset)
			ruleset = simplificationRules.basic;
		ruleset = jme.collectRuleset(ruleset,scope.rulesets);

		expr+='';	//make sure expr is a string

		if(!expr.trim().length)	//if expr is the empty string, don't bother going through the whole compilation proces
			return '';
		var tree = jme.display.simplify(expr,ruleset,scope); //compile the expression to a tree and simplify it
		var tex = texify(tree,ruleset.flags); //render the tree as TeX
		return tex;
	},

	/** Simplify a JME expression string according to the given ruleset and return it as a JME string
	 * 
	 * @param {JME} expr
	 * @param {string[]|Numbas.jme.Ruleset} ruleset - can be anything accepted by {@link Numbas.jme.display.collectRuleset}
	 * @param {Numbas.jme.Scope} scope
	 * @returns {JME}
	 *
	 * @see Numbas.jme.display.simplify
	 */
	simplifyExpression: function(expr,ruleset,scope)
	{
		if(expr.trim()=='')
			return '';
		return treeToJME(jme.display.simplify(expr,ruleset,scope),ruleset.flags);
	},

	/** Simplify a JME expression string according to given ruleset and return it as a syntax tree
	 *
	 * @param {JME} expr 
	 * @param {string[]|Numbas.jme.Ruleset} ruleset
	 * @param {Numbas.jme.Scope} scope
	 * @returns {Numbas.jme.tree}
	 *
	 * @see Numbas.jme.display.simplifyExpression
	 * @see Numbas.jme.display.simplifyTree
	 */
	simplify: function(expr,ruleset,scope)
	{
		if(expr.trim()=='')
			return;

		if(!ruleset)
			ruleset = simplificationRules.basic;
		ruleset = jme.collectRuleset(ruleset,scope.rulesets);		//collect the ruleset - replace set names with the appropriate Rule objects

		try 
		{
			var exprTree = jme.compile(expr,{},true);	//compile the expression to a tree. notypecheck is true, so undefined function names can be used.
			return jme.display.simplifyTree(exprTree,ruleset,scope);	// simplify the tree
		}
		catch(e) 
		{
			//e.message += '\nSimplifying expression failed. Expression was: '+expr;
			throw(e);
		}
	},

	/** Simplify a syntax tree according to the given ruleset
	 * 
	 * @param {Numbas.jme.tree} exprTree
	 * @param {string[]|Numbas.jme.Ruleset} ruleset
	 * @param {Numbas.jme.Scope} scope
	 * @returns {Numbas.jme.tree}
	 *
	 * @see Numbas.jme.display.simplify
	 */
	simplifyTree: function(exprTree,ruleset,scope)
	{
		if(!scope)
			throw(new Numbas.Error('jme.display.simplifyTree.no scope given'));
		scope = Numbas.util.copyobj(scope);
		scope.variables = {};	//remove variables from the scope so they don't accidentally get substituted in
		var applied = true;

		var rules = ruleset.rules;

		// apply rules until nothing can be done
		while( applied )
		{
			//the eval() function is a meta-function which, when used in the result of a rule, allows you to replace an expression with a single data value
			if(exprTree.tok.type=='function' && exprTree.tok.name=='eval')	
			{
				exprTree = {tok: Numbas.jme.evaluate(exprTree.args[0],scope)};
			}
			else
			{
				if(exprTree.args)	//if this token is an operation with arguments, try to simplify the arguments first
				{
					for(var i=0;i<exprTree.args.length;i++)
					{
						exprTree.args[i] = jme.display.simplifyTree(exprTree.args[i],ruleset,scope);
					}
				}
				applied = false;
				for( var i=0; i<rules.length;i++)	//check each rule
				{
					var match;
					if(match = rules[i].match(exprTree,scope))	//if rule can be applied, apply it!
					{
						exprTree = jme.substituteTree(Numbas.util.copyobj(rules[i].result,true),new jme.Scope([{variables:match}]));
						applied = true;
						break;
					}
				}
			}
		}
		return exprTree
	}
};


/// all private methods below here



/** Apply brackets to an op argument if appropriate
 * @memberof Numbas.jme.display
 * @private
 *
 * @param {Numbas.jme.tree} thing
 * @param {string[]} texArgs - the arguments of `thing`, as TeX
 * @param {number} i - the index of the argument to bracket
 * @returns {TeX}
 */
function texifyOpArg(thing,texArgs,i)
{
	var precedence = jme.precedence;
	var tex = texArgs[i];
	if(thing.args[i].tok.type=='op')	//if this is an op applied to an op, might need to bracket
	{
		var op1 = thing.args[i].tok.name;	//child op
		var op2 = thing.tok.name;			//parent op
		var p1 = precedence[op1];	//precedence of child op
		var p2 = precedence[op2];	//precedence of parent op

		//if leaving out brackets would cause child op to be evaluated after parent op, or precedences the same and parent op not commutative, or child op is negation and parent is exponentiation
		if( p1 > p2 || (p1==p2 && i>0 && !jme.commutative[op2]) || (op1=='-u' && precedence[op2]<=precedence['*']) )	
			tex = '\\left ( '+tex+' \\right )';
	}
	//complex numbers might need brackets round them when multiplied with something else or unary minusing
	else if(thing.args[i].tok.type=='number' && thing.args[i].tok.value.complex && thing.tok.type=='op' && (thing.tok.name=='*' || thing.tok.name=='-u') )	
	{
		var v = thing.args[i].tok.value;
		if(!(v.re==0 || v.im==0))
			tex = '\\left ( '+tex+' \\right )';
	}
	return tex;
}

/** Helper function for texing infix operators
 * @memberof Numbas.jme.display
 * @private
 *
 * @param {TeX} code - the TeX command for the operator
 * @returns {function} - a function which will convert a syntax tree with the operator at the top to TeX, by putting `code` in between the TeX of the two arguments.
 */
function infixTex(code)
{
	return function(thing,texArgs)
	{
		var arity = jme.builtinScope.functions[thing.tok.name][0].intype.length;
		if( arity == 1 )	//if operation is unary, prepend argument with code
		{
			return code+texArgs[0];
		}
		else if ( arity == 2 )	//if operation is binary, put code in between arguments
		{
			return texArgs[0]+' '+code+' '+texArgs[1];
		}
	}
}

/** Helper for texing nullary functions
 * @memberof Numbas.jme.display
 * @private
 *
 * @param {TeX} code - the TeX command for the function
 * @returns {function} - a function which returns the appropriate (constant) TeX code
 */
function nullaryTex(code)
{
	return function(thing,texArgs){ return '\\textrm{'+code+'}'; };
}

/** Helper function for texing functions
 * @memberof Numbas.jme.display
 * @private
 *
 * @param {TeX} code - the TeX command for the function
 * @returns {function} - a function which converts a syntax tree to the appropriate TeX
 */
function funcTex(code)
{
	return function(thing,texArgs)
	{
		return code+' \\left ( '+texArgs.join(', ')+' \\right )';
	}
}

/** Define how to texify each operation and function
 * @enum {function}
 * @memberof Numbas.jme.display
 */
var texOps = jme.display.texOps = {
	/** range definition. Should never really be seen */
	'#': (function(thing,texArgs) { return texArgs[0]+' \\, \\# \\, '+texArgs[1]; }),	

	/** logical negation */
	'!': infixTex('\\neg '),	

	/** unary addition */
	'+u': infixTex('+'),	

	/** unary minus */
	'-u': (function(thing,texArgs,settings) {
		var tex = texArgs[0];
		if( thing.args[0].tok.type=='op' )
		{
			var op = thing.args[0].tok.name;
			if(!(op=='/' || op=='*') && jme.precedence[op]>jme.precedence['-u'])	//brackets are needed if argument is an operation which would be evaluated after negation
			{
				tex='\\left ( '+tex+' \\right )';
			}
		}
		else if(thing.args[0].tok.type=='number' && thing.args[0].tok.value.complex) {
			var value = thing.args[0].tok.value;
			return settings.texNumber({complex:true,re:-value.re,im:-value.im});
		}
		return '-'+tex;
	}),

	/** exponentiation */
	'^': (function(thing,texArgs) {
		var tex0 = texArgs[0];
		//if left operand is an operation, it needs brackets round it. Exponentiation is right-associative, so 2^3^4 won't get any brackets, but (2^3)^4 will.
		if(thing.args[0].tok.type=='op' || (thing.args[0].tok.type=='function' && thing.args[0].tok.name=='exp'))
			tex0 = '\\left ( ' +tex0+' \\right )';	
		return (tex0+'^{ '+texArgs[1]+' }');
	}),


	'*': (function(thing,texArgs) {
		var s = texifyOpArg(thing,texArgs,0);
		for(var i=1; i<thing.args.length; i++ )
		{
			//specials or subscripts
			if(util.isInt(texArgs[i-1].charAt(texArgs[i-1].length-1)) && util.isInt(texArgs[i].charAt(0)))
			{ 
				s+=' \\times ';
			}
			else if(thing.args[i-1].tok.type=='special' || thing.args[i].tok.type=='special')	
			{
				s+=' ';
			}
			//anything times e^(something) or (not number)^(something)
			else if (jme.isOp(thing.args[i].tok,'^') && (thing.args[i].args[0].value==Math.E || thing.args[i].args[0].tok.type!='number'))	
			{
				s+=' ';
			}
			//real number times Pi or E
			else if (thing.args[i].tok.type=='number' && (thing.args[i].tok.value==Math.PI || thing.args[i].tok.value==Math.E || thing.args[i].tok.value.complex) && thing.args[i-1].tok.type=='number' && !(thing.args[i-1].tok.value.complex))	
			{
				s+=' ';
			}
			//number times a power of i
			else if (jme.isOp(thing.args[i].tok,'^') && thing.args[i].args[0].tok.type=='number' && math.eq(thing.args[i].args[0].tok.value,math.complex(0,1)) && thing.args[i-1].tok.type=='number')	
			{
				s+=' ';
			}
			else if ( !(thing.args[i-1].tok.type=='number' && math.eq(thing.args[i-1].tok.value,math.complex(0,1))) && thing.args[i].tok.type=='number' && math.eq(thing.args[i].tok.value,math.complex(0,1)))	//(anything except i) times i
			{
				s+=' ';
			}
			else if ( thing.args[i].tok.type=='number'
					||
						jme.isOp(thing.args[i].tok,'-u')
					||
					(
						!jme.isOp(thing.args[i].tok,'-u') 
						&& (thing.args[i].tok.type=='op' && jme.precedence[thing.args[i].tok.name]<=jme.precedence['*'] 
							&& (thing.args[i].args[0].tok.type=='number' 
							&& thing.args[i].args[0].tok.value!=Math.E)
						)
					)
			)
			{
				s += ' \\times ';
			}
			else
				s+= ' ';
			s += texifyOpArg(thing,texArgs,i);
		}
		return s;
	}),
	'/': (function(thing,texArgs) { return ('\\frac{ '+texArgs[0]+' }{ '+texArgs[1]+' }'); }),
	'+': infixTex('+'),
	'-': (function(thing,texArgs,settings) {
		var a = thing.args[0];
		var b = thing.args[1];
		if(b.tok.type=='number' && b.tok.value.complex && b.tok.value.re!=0) {
			var texb = settings.texNumber(math.complex(b.tok.value.re,-b.tok.value.im));
			return texArgs[0]+' - '+texb;
		}
		else{
			if(jme.isOp(b.tok,'+') || jme.isOp(b.tok,'-'))
				return texArgs[0]+' - \\left( '+texArgs[1]+' \\right)';
			else
				return texArgs[0]+' - '+texArgs[1];
		}
	}),
	'dot': infixTex('\\cdot'),
	'cross': infixTex('\\times'),
	'transpose': (function(thing,texArgs) {
		var tex = texArgs[0];
		if(thing.args[0].tok.type=='op')
			tex = '\\left ( ' +tex+' \\right )';
		return (tex+'^{\\mathrm{T}}');
	}),
	'..': infixTex('\\dots'),
	'except': infixTex('\\operatorname{except}'),
	'<': infixTex('\\lt'),
	'>': infixTex('\\gt'),
	'<=': infixTex('\\leq'),
	'>=': infixTex('\\geq'),
	'<>': infixTex('\neq'),
	'=': infixTex('='),
	'and': infixTex('\\wedge'),
	'or': infixTex('\\vee'),
	'xor': infixTex('\\, \\textrm{XOR} \\,'),
	'|': infixTex('|'),
	'abs': (function(thing,texArgs,settings) { 
		var arg;
		if(thing.args[0].tok.type=='vector')
			arg = texVector(thing.args[0].tok.value,settings);
		else if(thing.args[0].tok.type=='function' && thing.args[0].tok.name=='vector')
			arg = texVector(thing.args[0],settings);
		else if(thing.args[0].tok.type=='matrix')
			arg = texMatrix(thing.args[0].tok.value,settings);
		else if(thing.args[0].tok.type=='function' && thing.args[0].tok.name=='matrix')
			arg = texMatrix(thing.args[0],settings);
		else
			arg = texArgs[0];
		return ('\\left | '+arg+' \\right |');
	}),
	'sqrt': (function(thing,texArgs) { return ('\\sqrt{ '+texArgs[0]+' }'); }),
	'exp': (function(thing,texArgs) { return ('e^{ '+texArgs[0]+' }'); }),
	'fact': (function(thing,texArgs)
			{
				if(thing.args[0].tok.type=='number' || thing.args[0].tok.type=='name')
				{
					return texArgs[0]+'!';
				}
				else
				{
					return '\\left ('+texArgs[0]+' \\right)!';
				}
			}),
	'ceil': (function(thing,texArgs) { return '\\left \\lceil '+texArgs[0]+' \\right \\rceil';}),
	'floor': (function(thing,texArgs) { return '\\left \\lfloor '+texArgs[0]+' \\right \\rfloor';}),
	'int': (function(thing,texArgs) { return ('\\int \\! '+texArgs[0]+' \\, \\mathrm{d}'+texArgs[1]); }),
	'defint': (function(thing,texArgs) { return ('\\int_{'+texArgs[2]+'}^{'+texArgs[3]+'} \\! '+texArgs[0]+' \\, \\mathrm{d}'+texArgs[1]); }),
	'diff': (function(thing,texArgs) 
			{
				var degree = (thing.args[2].tok.type=='number' && thing.args[2].tok.value==1) ? '' : '^{'+texArgs[2]+'}';
				if(thing.args[0].tok.type=='name')
				{
					return ('\\frac{\\mathrm{d}'+degree+texArgs[0]+'}{\\mathrm{d}'+texArgs[1]+degree+'}');
				}
				else
				{
					return ('\\frac{\\mathrm{d}'+degree+'}{\\mathrm{d}'+texArgs[1]+degree+'} \\left ('+texArgs[0]+' \\right )');
				}
			}),
	'partialdiff': (function(thing,texArgs) 
			{ 
				var degree = (thing.args[2].tok.type=='number' && thing.args[2].tok.value==1) ? '' : '^{'+texArgs[2]+'}';
				if(thing.args[0].tok.type=='name')
				{
					return ('\\frac{\\partial '+degree+texArgs[0]+'}{\\partial '+texArgs[1]+degree+'}');
				}
				else
				{
					return ('\\frac{\\partial '+degree+'}{\\partial '+texArgs[1]+degree+'} \\left ('+texArgs[0]+' \\right )');
				}
			}),
	'limit': (function(thing,texArgs) { return ('\\lim_{'+texArgs[1]+' \\to '+texArgs[2]+'}{'+texArgs[0]+'}'); }),
	'mod': (function(thing,texArgs) {return texArgs[0]+' \\pmod{'+texArgs[1]+'}';}),
	'perm': (function(thing,texArgs) { return '^{'+texArgs[0]+'}\\kern-2pt P_{'+texArgs[1]+'}';}),
	'comb': (function(thing,texArgs) { return '^{'+texArgs[0]+'}\\kern-1pt C_{'+texArgs[1]+'}';}),
	'root': (function(thing,texArgs) { return '\\sqrt['+texArgs[1]+']{'+texArgs[0]+'}'; }),
	'if': (function(thing,texArgs) 
			{
				for(var i=0;i<3;i++)
				{
					if(thing.args[i].args!==undefined)
						texArgs[i] = '\\left ( '+texArgs[i]+' \\right )';
				}
				return '\\textbf{If} \\; '+texArgs[0]+' \\; \\textbf{then} \\; '+texArgs[1]+' \\; \\textbf{else} \\; '+texArgs[2]; 
			}),
	'switch': funcTex('\\operatorname{switch}'),
	'gcd': funcTex('\\operatorname{gcd}'),
	'lcm': funcTex('\\operatorname{lcm}'),
	'trunc': funcTex('\\operatorname{trunc}'),
	'fract': funcTex('\\operatorname{fract}'),
	'degrees': funcTex('\\operatorname{degrees}'),
	'radians': funcTex('\\operatorname{radians}'),
	'round': funcTex('\\operatorname{round}'),
	'sign': funcTex('\\operatorname{sign}'),
	'random': funcTex('\\operatorname{random}'),
	'max': funcTex('\\operatorname{max}'),
	'min': funcTex('\\operatorname{min}'),
	'precround': funcTex('\\operatorname{precround}'),
	'siground': funcTex('\\operatorname{siground}'),
	'award': funcTex('\\operatorname{award}'),
	'hour24': nullaryTex('hour24'),
	'hour': nullaryTex('hour'),
	'ampm': nullaryTex('ampm'),
	'minute': nullaryTex('minute'),
	'second': nullaryTex('second'),
	'msecond': nullaryTex('msecond'),
	'dayofweek': nullaryTex('dayofweek'),
	'sin': funcTex('\\sin'),
	'cos': funcTex('\\cos'),
	'tan': funcTex('\\tan'),
	'sec': funcTex('\\sec'),
	'cot': funcTex('\\cot'),
	'cosec': funcTex('\\csc'),
	'arccos': funcTex('\\arccos'),
	'arcsin': funcTex('\\arcsin'),
	'arctan': funcTex('\\arctan'),
	'cosh': funcTex('\\cosh'),
	'sinh': funcTex('\\sinh'),
	'tanh': funcTex('\\tanh'),
	'coth': funcTex('\\coth'),
	'cosech': funcTex('\\operatorname{cosech}'),
	'sech': funcTex('\\operatorname{sech}'),
	'arcsinh': funcTex('\\operatorname{arcsinh}'),
	'arccosh': funcTex('\\operatorname{arccosh}'),
	'arctanh': funcTex('\\operatorname{arctanh}'),
	'ln': function(thing,texArgs,settings) {
		if(thing.args[0].tok.type=='function' && thing.args[0].tok.name=='abs')
			return '\\ln '+texArgs[0];
		else
			return '\\ln \\left( '+texArgs[0]+' \\right)';
	},
	'log': funcTex('\\log_{10}'),
	'vector': (function(thing,texArgs,settings) {
		return '\\left( '+texVector(thing,settings)+' \\right)';
	}),
	'rowvector': (function(thing,texArgs,settings) {
		if(thing.args[0].tok.type!='list')
			return texMatrix({args:[{args:thing.args}]},settings,true);
		else
			return texMatrix(thing,settings,true);
	}),
	'matrix': (function(thing,texArgs,settings) {
		return texMatrix(thing,settings,true);
	}),
	'listval': (function(thing,texArgs) {
		return texArgs[0]+' \\left['+texArgs[1]+'\\right]';
	}),
	'verbatim': (function(thing,texArgs) {
		return thing.args[0].tok.value;
	}),
	'set': function(thing,texArgs,settings) {
		if(thing.args.length==1 && thing.args[0].tok.type=='list') {
			return '\\left\\{ '+texify(thing.args[0],settings)+' \\right\\}';
		} else {
			return '\\left\\{ '+texArgs.join(', ')+' \\right\\}';
		}
	}
}

/** Convert a number to TeX, displaying it as a fractionm using {@link Numbas.math.rationalApproximation}
 * @memberof Numbas.jme.display
 * @private
 * 
 * @param {number} n
 * @returns {TeX}
 */
var texRationalNumber = jme.display.texRationalNumber = function(n)
{
	if(n.complex)
	{
		var re = texRationalNumber(n.re);
		var im = texRationalNumber(n.im)+' i';
		if(n.im==0)
			return re;
		else if(n.re==0)
		{
			if(n.im==1)
				return 'i';
			else if(n.im==-1)
				return '-i';
			else
				return im;
		}
		else if(n.im<0)
		{
			if(n.im==-1)
				return re+' - i';
			else
				return re+' '+im;
		}
		else
		{
			if(n.im==1)
				return re+' + '+'i';
			else
				return re+' + '+im;
		}

	}
	else
	{
		var piD;
		if((piD = math.piDegree(n)) > 0)
			n /= Math.pow(Math.PI,piD);

		var m;
		var out = math.niceNumber(n);
		if(m = out.match(math.re_scientificNumber)) {
			var mantissa = m[1];
			var exponent = m[2];
			if(exponent[0]=='+')
				exponent = exponent.slice(1);
			return mantissa+' \\times 10^{'+exponent+'}';
		}

		var f = math.rationalApproximation(Math.abs(n));
		if(f[1]==1)
			out = Math.abs(f[0]).toString();
		else
			out = '\\frac{'+f[0]+'}{'+f[1]+'}';
		if(n<0)
			out=' - '+out;

		switch(piD)
		{
		case 0:
			return out;
		case 1:
			if(n==-1)
				return '-\\pi';
			else
				return out+' \\pi';
		default:
			if(n==-1)
				return '-\\pi^{'+piD+'}';
			else
				return out+' \\pi^{'+piD+'}';
		}
	}
}

/** Convert a number to TeX, displaying it as a decimal.
 * @memberof Numbas.jme.display
 * @private
 *
 * @param {number} n
 * @returns {TeX}
 */
function texRealNumber(n)
{
	if(n.complex)
	{
		var re = texRealNumber(n.re);
		var im = texRealNumber(n.im)+' i';
		if(n.im==0)
			return re;
		else if(n.re==0)
		{
			if(n.im==1)
				return 'i';
			else if(n.im==-1)
				return '-i';
			else
				return im;
		}
		else if(n.im<0)
		{
			if(n.im==-1)
				return re+' - i';
			else
				return re+' '+im;
		}
		else
		{
			if(n.im==1)
				return re+' + '+'i';
			else
				return re+' + '+im;
		}

	}
	else
	{
		if(n==Infinity)
			return '\\infty';
		else if(n==-Infinity)
			return '-\\infty';

		var piD;
		if((piD = math.piDegree(n)) > 0)
			n /= Math.pow(Math.PI,piD);

		var out = math.niceNumber(n);

		var m;
		if(m = out.match(math.re_scientificNumber)) {
			var mantissa = m[1];
			var exponent = m[2];
			if(exponent[0]=='+')
				exponent = exponent.slice(1);
			return mantissa+' \\times 10^{'+exponent+'}';
		}

		switch(piD)
		{
		case 0:
			return out;
		case 1:
			if(n==1)
				return '\\pi';
			else if(n==-1)
				return '-\\pi';
			else
				return out+' \\pi';
		default:
			if(n==1)
				return '\\pi^{'+piD+'}';
			else if(n==-1)
				return '-\\pi^{'+piD+'}';
			else
				return out+' \\pi^{'+piD+'}';
		}
	}
}

/** Convert a vector to TeX. If `settings.rowvector` is true, then it's set horizontally.
 * @memberof Numbas.jme.display
 * @private
 * 
 * @param {number[]|Numbas.jme.tree} v
 * @param {object} settings
 * @returns {TeX}
 */
function texVector(v,settings)
{
	var out;
	var elements;
	if(v.args)
	{
		elements = v.args.map(function(x){return texify(x,settings)});
	}
	else
	{
		var texNumber = settings.fractionnumbers ? texRationalNumber : texRealNumber;
		elements = v.map(function(x){return texNumber(x)});
	}
	if(settings.rowvector)
		out = elements.join(' , ');
	else
		out = '\\begin{matrix} '+elements.join(' \\\\ ')+' \\end{matrix}';
	return out;
}

/** Convert a matrix to TeX.
 * @memberof Numbas.jme.display
 * @private
 *
 * @param {Array.Array.<number>|Numbas.jme.tree} m
 * @param {object} settings
 * @param {boolean} parens - enclose the matrix in parentheses?
 * @returns {TeX}
 */
function texMatrix(m,settings,parens)
{
	var out;

	if(m.args)
	{
		var all_lists = true;
		var rows = m.args.map(function(x) {
			if(x.tok.type=='list') {
				return x.args.map(function(y){ return texify(y,settings); });
			} else {
				all_lists = false;
			}
		})
		if(!all_lists) {
			return '\\operatorname{matrix}(' + m.args.map(function(x){return texify(x,settings);}).join(',') +')';
		}
	}
	else
	{
		var texNumber = settings.fractionnumbers ? texRationalNumber : texRealNumber;
		var rows = m.map(function(x){
			return x.map(function(y){ return texNumber(y) });
		});
	}

	if(rows.length==1) {
		out = rows[0].join(', & ');
	}
	else {
		rows = rows.map(function(x) {
			return x.join(' & ');
		});
		out = rows.join(' \\\\ ');
	}

	if(parens)
		return '\\begin{pmatrix} '+out+' \\end{pmatrix}';
	else
		return '\\begin{matrix} '+out+' \\end{matrix}';
}

/** Dictionary of functions to convert specific name annotations to TeX
 *
 * @enum
 * @memberof Numbas.jme.display
 */
var texNameAnnotations = jme.display.texNameAnnotations = {
	verbatim: function(name) {	//verbatim - use to get round things like i and e being interpreted as constants
		return name;
	},
	op: function(name) {
		return '\\operatorname{'+name+'}';
	},
	vector: function(name) {
		return '\\boldsymbol{'+name+'}';
	},
	unit: function(name) {	//unit vector
		return '\\hat{'+name+'}';
	},
	dot: function(name) {		//dot on top
		return '\\dot{'+name+'}';
	},
	matrix: function(name) {
		return '\\mathrm{'+name+'}';
	}
}
texNameAnnotations.verb = texNameAnnotations.verbatim;
texNameAnnotations.v = texNameAnnotations.vector;
texNameAnnotations.m = texNameAnnotations.matrix;


/** Convert a variable name to TeX
 * @memberof Numbas.jme.display
 *
 * @param {string} name
 * @param {string[]} annotation - 
 * @returns {TeX}
 */

var texName = jme.display.texName = function(name,annotations)
{
	var name = greek.contains(name) ? '\\'+name : name;
	name = name.replace(/(.*)_(.*)('*)$/g,'$1_{$2}$3');	//make numbers at the end of a variable name subscripts
	name = name.replace(/^(.*?[^_])(\d+)('*)$/,'$1_{$2}$3');	//make numbers at the end of a variable name subscripts

	if(!annotations)
		return name;

	for(var i=0;i<annotations.length;i++)
	{
		var annotation = annotations[i];
		if(annotation in texNameAnnotations) {
			name = texNameAnnotations[annotation](name);
		} else {
			name = '\\'+annotation+'{'+name+'}';
		}
	}
	return name;
}

var greek = ['alpha','beta','gamma','delta','epsilon','zeta','eta','theta','iota','kappa','lambda','mu','nu','xi','omicron','pi','rho','sigma','tau','upsilon','phi','chi','psi','omega']

/** Dictionary of functions to turn {@link Numbas.jme.types} objects into TeX strings
 *
 * @enum
 * @memberof Numbas.jme.display
 */
var typeToTeX = jme.display.typeToTeX = {
	'number': function(thing,tok,texArgs,settings) {
		if(tok.value==Math.E)
			return 'e';
		else if(tok.value==Math.PI)
			return '\\pi';
		else
			return settings.texNumber(tok.value);
	},
	'string': function(thing,tok,texArgs,settings) {
		if(tok.latex)
			return tok.value;
		else
			return '\\textrm{'+tok.value+'}';
	},
	'boolean': function(thing,tok,texArgs,settings) {
		return tok.value ? 'true' : 'false';
	},
	range: function(thing,tok,texArgs,settings) {
		return tok.value[0]+ ' \\dots '+tok.value[1];
	},
	list: function(thing,tok,texArgs,settings) {
		if(!texArgs)
		{
			texArgs = [];
			for(var i=0;i<tok.vars;i++)
			{
				texArgs[i] = texify(tok.value[i],settings);
			}
		}
		return '\\left[ '+texArgs.join(', ')+' \\right]';
	},
	vector: function(thing,tok,texArgs,settings) {
		return ('\\left( ' 
				+ texVector(tok.value,settings)
				+ ' \\right)' );
	},
	matrix: function(thing,tok,texArgs,settings) {
		return '\\left( '+texMatrix(tok.value,settings)+' \\right)';
	},
	name: function(thing,tok,texArgs,settings) {
		return texName(tok.name,tok.annotation);
	},
	special: function(thing,tok,texArgs,settings) {
		return tok.value;
	},
	conc: function(thing,tok,texArgs,settings) {
		return texArgs.join(' ');
	},
	op: function(thing,tok,texArgs,settings) {
		return texOps[tok.name.toLowerCase()](thing,texArgs,settings);
	},
	'function': function(thing,tok,texArgs,settings) {
		if(texOps[tok.name.toLowerCase()])
		{
			return texOps[tok.name.toLowerCase()](thing,texArgs,settings);
		}
		else
		{
			if(tok.name.replace(/[^A-Za-z]/g,'').length==1)
				var texname=tok.name;
			else
				var texname='\\operatorname{'+tok.name+'}';

			return texName(texname,tok.annotation)+' \\left ( '+texArgs.join(', ')+' \\right )';
		}
	},
	set: function(thing,tok,texArgs,settings) {
		texArgs = [];
		for(var i=0;i<tok.value.length;i++) {
			texArgs.push(texify(tok.value[i],settings));
		}
		return '\\left\\{ '+texArgs.join(', ')+' \\right\\}';
	}
}
/** Turn a syntax tree into a TeX string. Data types can be converted to TeX straightforwardly, but operations and functions need a bit more care.
 *
 * The idea here is that each function and op has a function associated with it which takes a syntax tree with that op at the top and returns the appropriate TeX
 *
 * @memberof Numbas.jme.display
 * @method
 *
 * @param {Numbas.jme.tree} thing
 * @param {object} settings
 *
 * @returns {TeX}
 */
var texify = Numbas.jme.display.texify = function(thing,settings)
{
	if(!thing)
		return '';

	if(!settings)
		settings = {};

	if(thing.args)
	{
		var texArgs = [];
		for(var i=0; i<thing.args.length; i++ )
		{
			texArgs[i] = texify(thing.args[i],settings);
		}
	}

	settings.texNumber = settings.fractionnumbers ? texRationalNumber : texRealNumber;

	var tok = thing.tok || thing;
	if(tok.type in typeToTeX) {
		return typeToTeX[tok.type](thing,tok,texArgs,settings);
	} else {
		throw(new Numbas.Error(R('jme.display.unknown token type',tok.type)));
	}
}

/** Write a number in JME syntax as a fraction, using {@link Numbas.math.rationalApproximation}
 *
 * @memberof Numbas.jme.display
 * @private
 *
 * @param {number} n
 * @returns {JME}
 */
var jmeRationalNumber = jme.display.jmeRationalNumber = function(n)
{
	if(n.complex)
	{
		var re = jmeRationalNumber(n.re);
		var im = jmeRationalNumber(n.im)+'i';
		if(n.im==0)
			return re;
		else if(n.re==0)
		{
			if(n.im==1)
				return 'i';
			else if(n.im==-1)
				return '-i';
			else
				return im;
		}
		else if(n.im<0)
		{
			if(n.im==-1)
				return re+' - i';
			else
				return re+' - '+jmeRationalNumber(-n.im)+'i';
		}
		else
		{
			if(n.im==1)
				return re+' + '+'i';
			else
				return re+' + '+im;
		}

	}
	else
	{
		var piD;
		if((piD = math.piDegree(n)) > 0)
			n /= Math.pow(Math.PI,piD);

		
		var m;
		var out = math.niceNumber(n);
		if(m = out.match(math.re_scientificNumber)) {
			var mantissa = m[1];
			var exponent = m[2];
			if(exponent[0]=='+')
				exponent = exponent.slice(1);
			return mantissa+'*10^('+exponent+')';
		}

		var f = math.rationalApproximation(Math.abs(n));
		if(f[1]==1)
			out = Math.abs(f[0]).toString();
		else
			out = f[0]+'/'+f[1];
		if(n<0)
			out=' - '+out;

		switch(piD)
		{
		case 0:
			return out;
		case 1:
			return out+' pi';
		default:
			return out+' pi^'+piD;
		}
	}
}

/** Write a number in JME syntax as a decimal.
 *
 * @memberof Numbas.jme.display
 * @private
 *
 * @param {number} n
 * @returns {JME}
 */
function jmeRealNumber(n)
{
	if(n.complex)
	{
		var re = jmeRealNumber(n.re);
		var im = jmeRealNumber(n.im);
		if(im[im.length-1].match(/[a-zA-Z]/))
			im += '*i';
		else
			im += 'i';

		if(n.im==0)
			return re;
		else if(n.re==0)
		{
			if(n.im==1)
				return 'i';
			else if(n.im==-1)
				return '-i';
			else
				return im;
		}
		else if(n.im<0)
		{
			if(n.im==-1)
				return re+' - i';
			else
				return re+' - '+jmeRealNumber(-n.im)+'i';
		}
		else
		{
			if(n.im==1)
				return re+' + i';
			else
				return re+' + '+im;
		}

	}
	else
	{
		if(n==Infinity)
			return 'infinity';
		else if(n==-Infinity)
			return '-infinity';

		var piD;
		if((piD = math.piDegree(n)) > 0)
			n /= Math.pow(Math.PI,piD);

		var out = math.niceNumber(n);

		var m;
		if(m = out.match(math.re_scientificNumber)) {
			var mantissa = m[1];
			var exponent = m[2];
			if(exponent[0]=='+')
				exponent = exponent.slice(1);
			return mantissa+'*10^('+exponent+')';
		}

		
		switch(piD)
		{
		case 0:
			return out;
		case 1:
			if(n==1)
				return 'pi';
			else
				return out+' pi';
		default:
			if(n==1)
				return 'pi^'+piD;
			else
				return out+' pi^'+piD;
		}
	}
}

/** Dictionary of functions to turn {@link Numbas.jme.types} objects into JME strings
 *
 * @enum
 * @memberof Numbas.jme.display
 */
var typeToJME = Numbas.jme.display.typeToJME = {
	'number': function(tree,tok,bits,settings) {
		switch(tok.value)
		{
		case Math.E:
			return 'e';
		case Math.PI:
			return 'pi';
		default:
			return settings.jmeNumber(tok.value);
		}
	},
	name: function(tree,tok,bits,settings) {
		return tok.name;
	},
	'string': function(tree,tok,bits,settings) {
		var str = tok.value
					.replace(/\\/g,'\\\\')
					.replace(/\\([{}])/g,'$1')
					.replace(/\n/g,'\\n')
					.replace(/"/g,'\\"')
					.replace(/'/g,"\\'")
		;
		return '"'+str+'"';
	},
	html: function(tree,tok,bits,settings) {
		var html = $(tok.value).clone().wrap('<div>').parent().html();
		html = html.replace(/"/g,'\\"');
		return 'html("'+html+'")';
	},
	'boolean': function(tree,tok,bits,settings) {
		return (tok.value ? 'true' : 'false');
	},
	range: function(tree,tok,bits,settings) {
		return tok.value[0]+'..'+tok.value[1]+(tok.value[2]==1 ? '' : '#'+tok.value[2]);
	},
	list: function(tree,tok,bits,settings) {
		if(!bits)
		{
			if(tok.value) {
				bits = tok.value.map(function(b){return treeToJME({tok:b},settings);});
			}
			else {
				bits = [];
			}
		}
		return '[ '+bits.join(', ')+' ]';
	},
	vector: function(tree,tok,bits,settings) {
		return 'vector('+tok.value.map(settings.jmeNumber).join(',')+')';
	},
	matrix: function(tree,tok,bits,settings) {
		return 'matrix('+
			tok.value.map(function(row){return '['+row.map(settings.jmeNumber).join(',')+']'}).join(',')+')';
	},
	'function': function(tree,tok,bits,settings) {
		return tok.name+'('+bits.join(',')+')';
	},
	op: function(tree,tok,bits,settings) {
		var op = tok.name;
		var args = tree.args, l = args.length;

		for(var i=0;i<l;i++)
		{
			var arg_type = args[i].tok.type;
			var arg_value = args[i].tok.value;
			var pd;

			if(arg_type=='op' && op in opBrackets && opBrackets[op][i][args[i].tok.name]==true)
			{
				bits[i]='('+bits[i]+')';
				args[i].bracketed=true;
			}
			else if(arg_type=='number' && arg_value.complex && (op=='*' || op=='-u' || op=='/'))	// put brackets round a complex number
			{
				if(arg_value.im!=0 && arg_value.im!=1)
				{
					bits[i] = '('+bits[i]+')';
					args[i].bracketed = true;
				}
			} else if(arg_type=='number' && (pd = math.piDegree(args[i].tok.value))>0 && arg_value/math.pow(Math.PI,pd)>1 && (op=='*' || op=='-u' || op=='/')) {
				bits[i] = '('+bits[i]+')';
				args[i].bracketed = true;
			}
		}
		
		//omit multiplication symbol when not necessary
		if(op=='*')
		{
			//number or brackets followed by name or brackets doesn't need a times symbol
			//except <anything>*(-<something>) does
			if( ((args[0].tok.type=='number' && math.piDegree(args[0].tok.value)==0 && args[0].tok.value!=Math.E) || args[0].bracketed) && (args[1].tok.type == 'name' || args[1].bracketed && !jme.isOp(tree.args[1].tok,'-u')) )	
			{
				op = '';
			}
		}

		switch(op)
		{
		case '+u':
			op='+';
			break;
		case '-u':
			op='-';
			if(args[0].tok.type=='number' && args[0].tok.value.complex)
				return settings.jmeNumber({complex:true, re: -args[0].tok.value.re, im: -args[0].tok.value.im});
			break;
		case '-':
			var b = args[1].tok.value;
			if(args[1].tok.type=='number' && args[1].tok.value.complex && args[1].tok.value.re!=0) {
				return bits[0]+' - '+settings.jmeNumber(math.complex(b.re,-b.im));
			}
			op = ' - ';
			break;
		case 'and':
		case 'or':
		case 'isa':
		case 'except':
		case '+':
			op=' '+op+' ';
			break;
		case 'not':
			op = 'not ';
		}

		if(l==1)
			{return op+bits[0];}
		else
			{return bits[0]+op+bits[1];}
	},
	set: function(tree,tok,bits,settings) {
		return 'set('+tok.value.map(function(thing){return treeToJME({tok:thing},settings);}).join(',')+')';
	}
}

/** Turn a syntax tree back into a JME expression (used when an expression is simplified)
 * @memberof Numbas.jme.display
 * @method
 * 
 * @param {Numbas.jme.tree} tree
 * @param {object} settings
 * @returns {JME}
 */
var treeToJME = jme.display.treeToJME = function(tree,settings)
{
	if(!tree)
		return '';

	settings = settings || {};

	var args=tree.args, l;

	if(args!==undefined && ((l=args.length)>0))
	{
		var bits = args.map(function(i){return treeToJME(i,settings)});
	}

    settings.jmeNumber = settings.fractionnumbers ? jmeRationalNumber : jmeRealNumber;

	var tok = tree.tok;
	if(tok.type in typeToJME) {
		return typeToJME[tok.type](tree,tok,bits,settings);
	} else {
		throw(new Numbas.Error(R('jme.display.unknown token type',tok.type)));
	}
}


/** Does each argument (of an operation) need brackets around it?
 *
 * Arrays consisting of one object for each argument of the operation
 * @enum
 * @memberof Numbas.jme.display
 * @private
 */
var opBrackets = Numbas.jme.display.opBrackets = {
	'+u':[{}],
	'-u':[{'+':true,'-':true}],
	'+': [{},{}],
	'-': [{},{'+':true,'-':true}],
	'*': [{'+u':true,'-u':true,'+':true, '-':true, '/':true},{'+u':true,'-u':true,'+':true, '-':true, '/':true}],
	'/': [{'+u':true,'-u':true,'+':true, '-':true, '*':true},{'+u':true,'-u':true,'+':true, '-':true, '*':true}],
	'^': [{'+u':true,'-u':true,'+':true, '-':true, '*':true, '/':true},{'+u':true,'-u':true,'+':true, '-':true, '*':true, '/':true}],
	'and': [{'or':true, 'xor':true},{'or':true, 'xor':true}],
	'or': [{'xor':true},{'xor':true}],
	'xor':[{},{}],
	'=': [{},{}]
};

/** Simplification rule
 * @memberof Numbas.jme.display
 * @constructor
 *
 * @param {JME} pattern - expression pattern to match. Variables will match any sub-expression.
 * @param {JME[]} conditions - conditions as expressions in JME expressions on the matched variables, which must all evaluate to true for the rule to match.
 * @param {JME} result - expression pattern to rewrite to.
 * 
 * @property {JME} patternString
 * @property {Numbas.jme.tree} tree - `patternString` compiled to a syntax tree
 * @property {Numbas.jme.tree} result - `result` compiled to a syntax tree
 * @property {Numbas.jme.tree[]} conditions `conditions` compiled to syntax trees
 */
var Rule = jme.display.Rule = function(pattern,conditions,result)
{
	this.patternString = pattern;
	this.tree = jme.compile(pattern,{},true);

	this.result = jme.compile(result,{},true);

	this.conditions = [];
	for(var i=0;i<conditions.length;i++)
	{
		this.conditions.push(jme.compile(conditions[i],{},true));
	}
}

Rule.prototype = /** @lends Numbas.jme.display.Rule.prototype */ {
	/** Match a rule on given syntax tree.
	 * @memberof Numbas.jme.display.Rule.prototype
	 * @param {Numbas.jme.tree} exprTree - the syntax tree to test
	 * @param {Numbas.jme.Scope} scope - used when checking conditions
	 * @returns {boolean|object} - `false` if no match, or a dictionary of matched subtrees
	 */
	match: function(exprTree,scope)
	{
		//see if expression matches rule
		var match = matchTree(this.tree,exprTree);
		if(match==false)
			return false;

		//if expression matches rule, then match is a dictionary of matched variables
		//check matched variables against conditions
		if(this.matchConditions(match,scope))
			return match;
		else
			return false;
	},

	/** Check that a matched pattern satisfies all the rule's conditions
	 * @memberof Numbas.jme.display.Rule.prototype
	 * @param {object} match
	 * @param {Numbas.jme.Scope} scope
	 * @returns {boolean}
	 */
	matchConditions: function(match,scope)
	{
		for(var i=0;i<this.conditions.length;i++)
		{
			var c = Numbas.util.copyobj(this.conditions[i],true);
			c = jme.substituteTree(c,new jme.Scope([{variables:match}]));
			try
			{
				var result = jme.evaluate(c,scope);
				if(result.value==false)
					return false;
			}
			catch(e)
			{
				return false;
			}
		}
		return true;
	}
}

var endTermNames = {
	'??':true,
	'm_nothing':true,
	'm_number': true
}
function isEndTerm(term) {
	while(term.tok.type=='function' && /^m_(?:all|pm|not|commute)$/.test(term.tok.name) || jme.isOp(term.tok,';')) {
		term = term.args[0];
	}
	if(term.tok.type=='function' && term.tok.name=='m_any') {
		for(var i=0;i<term.args.length;i++) {
			if(isEndTerm(term.args[i])) {
				return true;
			}
		}
		return false;
	}
	return term.tok.type=='name' && endTermNames[term.tok.name];
}

function getCommutingTerms(tree,op,names) {
	if(names===undefined) {
		names = [];
	}

	if(op=='+' && jme.isOp(tree.tok,'-')) {
		tree = {tok: new jme.types.TOp('+'), args: [tree.args[0],{tok: new jme.types.TOp('-u'), args: [tree.args[1]]}]};
	}

	if(!tree.args || tree.tok.name!=op) {
		return {terms: [tree], termnames: names.slice()};
	}

	var terms = [];
	var termnames = [];
	var rest = [];
	var restnames = [];
	for(var i=0; i<tree.args.length;i++) {
		var arg = tree.args[i];
		var oarg = arg;
		var argnames = names.slice();
		while(jme.isOp(arg.tok,';')) {
			argnames.push(arg.args[1].tok.name);
			arg = arg.args[0];
		}
		if(jme.isOp(arg.tok,op) || (op=='+' && jme.isOp(arg.tok,'-'))) {
			var sub = getCommutingTerms(arg,op,argnames);
			terms = terms.concat(sub.terms);
			termnames = termnames.concat(sub.termnames);
		} else if(jme.isName(arg.tok,'?') || isEndTerm(arg)) {
			rest.push(arg);
			restnames.push(argnames);
		} else {
			terms.push(arg);
			termnames.push(argnames);
		}
	}
	if(rest.length) {
		terms = terms.concat(rest);
		termnames = termnames.concat(restnames);
	}
	return {terms: terms, termnames: termnames};
}
Numbas.jme.display.getCommutingTerms = getCommutingTerms;

/** Recusrively check whether `exprTree` matches `ruleTree`. Variables in `ruleTree` match any subtree.
 * @memberof Numbas.jme.display
 *
 * @param {Numbas.jme.tree} ruleTree
 * @param {Numbas.jme.tree} exprTree
 * @param {boolean} doCommute - take commutativity of operations into account, e.g. terms of a sum can be in any order.
 * @returns {boolean|object} - `false` if no match, otherwise a dictionary of subtrees matched to variable names
 */
function matchTree(ruleTree,exprTree,doCommute)
{
	if(doCommute===undefined) {
		doCommute = false;
	}
	if(!exprTree)
		return false;

	var ruleTok = ruleTree.tok;
	var exprTok = exprTree.tok;

	if(jme.isOp(ruleTok,';')) {
		if(ruleTree.args[1].tok.type!='name') {
			throw(new Numbas.Error('jme.matchTree.group name not a name'));
		}
		var name = ruleTree.args[1].tok.name;
		var m = matchTree(ruleTree.args[0],exprTree,doCommute);
		if(m) {
			m[name] = exprTree;
			return m;
		} else {
			return false;
		}
	}

	if(ruleTok.type=='name')
	{
		switch(ruleTok.name) {
			case '?':
			case '??':
				return {};
			case 'm_number':
				return exprTok.type=='number' ? {} : false;
		}
	}

	if(ruleTok.type=='function') {
		switch(ruleTok.name) {
			case 'm_any':
				for(var i=0;i<ruleTree.args.length;i++) {
					var m;
					if(m=matchTree(ruleTree.args[i],exprTree,doCommute)) {
						return m;
					}
				}
				return false;

			case 'm_all':
				return matchTree(ruleTree.args[0],exprTree,doCommute);

			case 'm_pm':
				if(jme.isOp(exprTok,'-u')) {
					return matchTree({tok: new jme.types.TOp('-u'),args: [ruleTree.args[0]]},exprTree,doCommute);
				} else {
					return matchTree(ruleTree.args[0],exprTree,doCommute);
				}

			case 'm_not':
				if(!matchTree(ruleTree.args[0],exprTree,doCommute)) {
					return {};
				} else {
					return false;
				}

			case 'm_and':
				var d = {};
				for(var i=0;i<ruleTree.args.length;i++) {
					var m = matchTree(ruleTree.args[i],exprTree,doCommute);
					if(m) {
						for(var name in m) {
							d[name] = m[name];
						}
					} else {
						return false;
					}
				}
				return d;

			case 'm_uses':
				var vars = jme.findvars(exprTree);
				for(var i=0;i<ruleTree.args.length;i++) {
					var name = ruleTree.args[i].tok.name;
					if(!vars.contains(name)) {
						return false;
					}
				}
				return {};

			case 'm_commute':
				return matchTree(ruleTree.args[0],exprTree,true);

			case 'm_type':
				var wantedType = ruleTree.args[0].tok.name || ruleTree.args[0].tok.value;
				if(exprTok.type==wantedType) {
					return {};
				} else {
					return false;
				}
		}
	}
	if(jme.isName(ruleTok,'m_nothing')) {
		return false;
	} else if(jme.isName(ruleTok,'m_number')) {
		if(exprTok.type=='number') {
			return {};
		} else {
			return false;
		}
	}

	if(ruleTok.type!='op' && ruleTok.type != exprTok.type)
	{
		return false;
	}

	switch(ruleTok.type)
	{
	case 'number':
		if( !math.eq(ruleTok.value,exprTok.value) ) {
			return false;
		} else {
			return {};
		}

	case 'string':
	case 'boolean':
	case 'special':
	case 'range':
		if(ruleTok.value != exprTok.value) {
			return false;
		} else {
			return {};
		}

	case 'function':
	case 'op':
		var d = {};

		if(doCommute && jme.commutative[ruleTok.name]) {
			var commutingOp = ruleTok.name;

			var ruleTerms = getCommutingTerms(ruleTree,commutingOp);
			var exprTerms = getCommutingTerms(exprTree,commutingOp);
			var rest = [];

			var namedTerms = {};
			var matchedRules = [];
			var termMatches = [];

			for(var i=0; i<exprTerms.terms.length; i++) {
				var m = null;
				var matched = false;
				for(var j=0; j<ruleTerms.terms.length; j++) {
					var ruleTerm = ruleTerms.terms[j];
					m = matchTree(ruleTerm,exprTerms.terms[i],doCommute);
					if((!matchedRules[j] || ruleTerm.tok.name=='m_all') && m) {
						matched = true;
						matchedRules[j] = true;
						for(var name in m) {
							if(!namedTerms[name]) {
								namedTerms[name] = [];
							}
							namedTerms[name].push(m[name]);
						}
						var names = ruleTerms.termnames[j];
						if(names) {
							for(var k=0;k<names.length;k++) {
								var name = names[k];
								if(!namedTerms[name]) {
									namedTerms[name] = [];
								}
								namedTerms[name].push(exprTerms.terms[i]);
							}
						}
						break;
					}
				}
				if(!matched) {
					return false;
				}
			}
			for(var i=0;i<ruleTerms.terms.length;i++) {
				var term = ruleTerms.terms[i];
				if(!isEndTerm(term) && !matchedRules[i]) {
					return false;
				}
			}
			for(var name in namedTerms) {
				var terms = namedTerms[name];
				var sub = terms[0];
				for(var i=1;i<terms.length;i++) {
					var op = new jme.types.TOp(commutingOp);
					sub = {tok: op, args: [sub,terms[i]]};
				}
				d[name] = sub;
			}
			return d;
		} else {
			if(ruleTok.type!=exprTok.type || ruleTok.name!=exprTok.name) {
				return false;
			}
			for(var i=0;i<ruleTree.args.length;i++)
			{
				var m = matchTree(ruleTree.args[i],exprTree.args[i],doCommute);
				if(m==false) {
					return false;
				} else {
					for(var x in m) {
						d[x]=m[x];
					}
				}
			}
			return d
		}
	case 'name':
		if(ruleTok.name.toLowerCase()==exprTok.name.toLowerCase()) {
			return {};
		} else {
			return false;
		}
	default:
		return {};
	}
}
jme.display.matchTree = matchTree;

/** Match expresison against a pattern. Wrapper for {@link Numbas.jme.display.matchTree}
 *
 * @memberof Numbas.jme.display
 * @method
 *
 * @param {JME} pattern
 * @param {JME} expr
 * @param {boolean} doCommute
 *
 * @returns {boolean|object} - `false` if no match, otherwise a dictionary of subtrees matched to variable names
 */
var matchExpression = jme.display.matchExpression = function(pattern,expr,doCommute) {
	pattern = jme.compile(pattern);
	expr = jme.compile(expr);
	return matchTree(pattern,expr,doCommute);
}

/** Built-in simplification rules
 * @enum {Numbas.jme.display.Rule[]}
 * @memberof Numbas.jme.display
 */
var simplificationRules = jme.display.simplificationRules = {
	basic: [
		['+(?;x)',[],'x'],					//get rid of unary plus
		['?;x+(-?;y)',[],'x-y'],			//plus minus = minus
		['?;x+?;y',['y<0'],'x-eval(-y)'],
		['?;x-?;y',['y<0'],'x+eval(-y)'],
		['?;x-(-?;y)',[],'x+y'],			//minus minus = plus
		['-(-?;x)',[],'x'],				//unary minus minus = plus
		['-?;x',['x isa "complex"','re(x)<0'],'eval(-x)'],
		['?;x+?;y',['x isa "number"','y isa "complex"','re(y)=0'],'eval(x+y)'],
		['-?;x+?;y',['x isa "number"','y isa "complex"','re(y)=0'],'-eval(x-y)'],
		['(-?;x)/?;y',[],'-(x/y)'],			//take negation to left of fraction
		['?;x/(-?;y)',[],'-(x/y)'],			
		['(-?;x)*?;y',[],'-(x*y)'],			//take negation to left of multiplication
		['?;x*(-?;y)',[],'-(x*y)'],		
		['?;x+(?;y+?;z)',[],'(x+y)+z'],		//make sure sums calculated left-to-right
		['?;x-(?;y+?;z)',[],'(x-y)-z'],
		['?;x+(?;y-?;z)',[],'(x+y)-z'],
		['?;x-(?;y-?;z)',[],'(x-y)+z'],
		['(?;x*?;y)*?;z',[],'x*(y*z)'],		//make sure multiplications go right-to-left
		['?;n*i',['n isa "number"'],'eval(n*i)'],			//always collect multiplication by i
		['i*?;n',['n isa "number"'],'eval(n*i)']
	],

	unitFactor: [
		['1*?;x',[],'x'],
		['?;x*1',[],'x']
	],

	unitPower: [
		['?;x^1',[],'x']
	],

	unitDenominator: [
		['?;x/1',[],'x']
	],

	zeroFactor: [
		['?;x*0',[],'0'],
		['0*?;x',[],'0'],
		['0/?;x',[],'0']
	],

	zeroTerm: [
		['0+?;x',[],'x'],
		['?;x+0',[],'x'],
		['?;x-0',[],'x'],
		['0-?;x',[],'-x']
	],

	zeroPower: [
		['?;x^0',[],'1']
	],

	noLeadingMinus: [
		['-?;x+?;y',[],'y-x']											//don't start with a unary minus
	],

	collectNumbers: [
		['-?;x-?;y',['x isa "number"','y isa "number"'],'-(x+y)'],										//collect minuses
		['?;n+?;m',['n isa "number"','m isa "number"'],'eval(n+m)'],	//add numbers
		['?;n-?;m',['n isa "number"','m isa "number"'],'eval(n-m)'],	//subtract numbers
		['?;n+?;x',['n isa "number"','!(x isa "number")'],'x+n'],		//add numbers last

		['(?;x+?;n)+?;m',['n isa "number"','m isa "number"'],'x+eval(n+m)'],	//collect number sums
		['(?;x-?;n)+?;m',['n isa "number"','m isa "number"'],'x+eval(m-n)'],	
		['(?;x+?;n)-?;m',['n isa "number"','m isa "number"'],'x+eval(n-m)'],	
		['(?;x-?;n)-?;m',['n isa "number"','m isa "number"'],'x-eval(n+m)'],	
		['(?;x+?;n)+?;y',['n isa "number"'],'(x+y)+n'],						//shift numbers to right hand side
		['(?;x+?;n)-?;y',['n isa "number"'],'(x-y)+n'],
		['(?;x-?;n)+?;y',['n isa "number"'],'(x+y)-n'],
		['(?;x-?;n)-?;y',['n isa "number"'],'(x-y)-n'],

		['?;n*?;m',['n isa "number"','m isa "number"'],'eval(n*m)'],		//multiply numbers
		['?;x*?;n',['n isa "number"','!(x isa "number")','n<>i'],'n*x'],			//shift numbers to left hand side
		['?;m*(?;n*?;x)',['m isa "number"','n isa "number"'],'eval(n*m)*x']
	],

	simplifyFractions: [
		['?;n/?;m',['n isa "number"','m isa "number"','gcd_without_pi_or_i(n,m)>1'],'eval(n/gcd_without_pi_or_i(n,m))/eval(m/gcd_without_pi_or_i(n,m))'],			//cancel simple fraction
		['(?;n*?;x)/?;m',['n isa "number"','m isa "number"','gcd_without_pi_or_i(n,m)>1'],'(eval(n/gcd_without_pi_or_i(n,m))*x)/eval(m/gcd_without_pi_or_i(n,m))'],	//cancel algebraic fraction
		['?;n/(?;m*?;x)',['n isa "number"','m isa "number"','gcd_without_pi_or_i(n,m)>1'],'eval(n/gcd_without_pi_or_i(n,m))/(eval(m/gcd_without_pi_or_i(n,m))*x)'],	
		['(?;n*?;x)/(?;m*?;y)',['n isa "number"','m isa "number"','gcd_without_pi_or_i(n,m)>1'],'(eval(n/gcd_without_pi_or_i(n,m))*x)/(eval(m/gcd_without_pi_or_i(n,m))*y)'],
		['?;n/?;m',['n isa "complex"','m isa "complex"','re(n)=0','re(m)=0'],'eval(n/i)/eval(m/i)']			// cancel i when numerator and denominator are both purely imaginary
	],

	zeroBase: [
		['0^?;x',[],'0']
	],

	constantsFirst: [
		['?;x*?;n',['n isa "number"','!(x isa "number")','n<>i'],'n*x'],
		['?;x*(?;n*?;y)',['n isa "number"','n<>i','!(x isa "number")'],'n*(x*y)']
	],

	sqrtProduct: [
		['sqrt(?;x)*sqrt(?;y)',[],'sqrt(x*y)']
	],

	sqrtDivision: [
		['sqrt(?;x)/sqrt(?;y)',[],'sqrt(x/y)']
	],

	sqrtSquare: [
		['sqrt(?;x^2)',[],'x'],
		['sqrt(?;x)^2',[],'x'],
		['sqrt(?;n)',['n isa "number"','isint(sqrt(n))'],'eval(sqrt(n))']
	],

	trig: [
		['sin(?;n)',['n isa "number"','isint(2*n/pi)'],'eval(sin(n))'],
		['cos(?;n)',['n isa "number"','isint(2*n/pi)'],'eval(cos(n))'],
		['tan(?;n)',['n isa "number"','isint(n/pi)'],'0'],
		['cosh(0)',[],'1'],
		['sinh(0)',[],'0'],
		['tanh(0)',[],'0']
	],

	otherNumbers: [
		['?;n^?;m',['n isa "number"','m isa "number"'],'eval(n^m)']
	]
};
/** Compile an array of rules (in the form `[pattern,conditions[],result]` to {@link Numbas.jme.display.Rule} objects
 * @param {Array} rules
 * @returns {Numbas.jme.Ruleset}
 */
var compileRules = jme.display.compileRules = function(rules)
{
	for(var i=0;i<rules.length;i++)
	{
		pattern = rules[i][0];
		conditions = rules[i][1];
		result = rules[i][2];
		rules[i] = new Rule(pattern,conditions,result);
	}
	return new jme.Ruleset(rules,{});
}

var all=[];
var nsimplificationRules = Numbas.jme.display.simplificationRules = {};
for(var x in simplificationRules)
{
	nsimplificationRules[x] = nsimplificationRules[x.toLowerCase()] = compileRules(simplificationRules[x]);
	all = all.concat(nsimplificationRules[x].rules);
}
simplificationRules = nsimplificationRules;
simplificationRules['all']=new jme.Ruleset(all,{});

Numbas.jme.builtinScope = new Numbas.jme.Scope([Numbas.jme.builtinScope,{rulesets: simplificationRules}]);
});

Numbas.queueScript('SCORM_API_wrapper',[],function(module) {
/* ===========================================================

pipwerks SCORM Wrapper for JavaScript
v1.1.20121005

Created by Philip Hutchison, January 2008
https://github.com/pipwerks/scorm-api-wrapper

Copyright (c) Philip Hutchison
MIT-style license: http://pipwerks.mit-license.org/

This wrapper works with both SCORM 1.2 and SCORM 2004.

Inspired by APIWrapper.js, created by the ADL and
Concurrent Technologies Corporation, distributed by
the ADL (http://www.adlnet.gov/scorm).

SCORM.API.find() and SCORM.API.get() functions based
on ADL code, modified by Mike Rustici
(http://www.scorm.com/resources/apifinder/SCORMAPIFinder.htm),
further modified by Philip Hutchison

=============================================================== */


var pipwerks = {};                                  //pipwerks 'namespace' helps ensure no conflicts with possible other "SCORM" variables
pipwerks.UTILS = {};                                //For holding UTILS functions
pipwerks.debug = { isActive: false };                //Enable (true) or disable (false) for debug mode

pipwerks.SCORM = {                                  //Define the SCORM object
    version:    null,                               //Store SCORM version.
    handleCompletionStatus: true,                   //Whether or not the wrapper should automatically handle the initial completion status
    handleExitMode: true,                           //Whether or not the wrapper should automatically handle the exit mode
    API:        { handle: null,
                  isFound: false },                 //Create API child object
    connection: { isActive: false },                //Create connection child object
    data:       { completionStatus: null,
                  exitStatus: null },               //Create data child object
    debug:      {}                                  //Create debug child object
};



/* --------------------------------------------------------------------------------
   pipwerks.SCORM.isAvailable
   A simple function to allow Flash ExternalInterface to confirm
   presence of JS wrapper before attempting any LMS communication.

   Parameters: none
   Returns:    Boolean (true)
----------------------------------------------------------------------------------- */

pipwerks.SCORM.isAvailable = function(){
    return true;
};



// ------------------------------------------------------------------------- //
// --- SCORM.API functions ------------------------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.API.find(window)
   Looks for an object named API in parent and opener windows

   Parameters: window (the browser window object).
   Returns:    Object if API is found, null if no API found
---------------------------------------------------------------------------- */

pipwerks.SCORM.API.find = function(win){

    var API = null,
		findAttempts = 0,
        findAttemptLimit = 500,
		errorGettingAPI = false;
		traceMsgPrefix = "SCORM.API.find",
		trace = pipwerks.UTILS.trace,
		scorm = pipwerks.SCORM;

	try {
		while (!errorGettingAPI &&
			   (!win.API && !win.API_1484_11) &&
			   (win.parent) &&
			   (win.parent != win) &&
			   (findAttempts <= findAttemptLimit)){

					findAttempts++;
					win = win.parent;

		}
	}
	catch(e) {
		errorGettingAPI = e;
	}

	try {
		if(scorm.version){											//If SCORM version is specified by user, look for specific API
		
			switch(scorm.version){
				
				case "2004" : 
				
					if(win.API_1484_11){
				
						API = win.API_1484_11;
					 
					} else {
						
						trace(traceMsgPrefix +": SCORM version 2004 was specified by user, but API_1484_11 cannot be found.");
						
					}
					
					break;
					
				case "1.2" : 
				
					if(win.API){
				
						API = win.API;
					 
					} else {
						
						trace(traceMsgPrefix +": SCORM version 1.2 was specified by user, but API cannot be found.");
						
					}
					
					break;
				
			}
			
		} else {													//If SCORM version not specified by user, look for APIs
			
			if(win.API_1484_11) {									//SCORM 2004-specific API.
		
				scorm.version = "2004";								//Set version
				API = win.API_1484_11;
			 
			} else if(win.API){										//SCORM 1.2-specific API
				  
				scorm.version = "1.2";								//Set version
				API = win.API;
			 
			}

		}
	}
	catch(e) {
		errorGettingAPI = e;
	}

	if(API){
		
		trace(traceMsgPrefix +": API found. Version: " +scorm.version);
		trace("API: " +API);

	} else {
		
		trace(traceMsgPrefix +": Error finding API. \nFind attempts: " +findAttempts +". \nFind attempt limit: " +findAttemptLimit+". \nError getting window parent: "+errorGettingAPI);
		
	}
	
    return API;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.API.get()
   Looks for an object named API, first in the current window's frame
   hierarchy and then, if necessary, in the current window's opener window
   hierarchy (if there is an opener window).

   Parameters:  None.
   Returns:     Object if API found, null if no API found
---------------------------------------------------------------------------- */

pipwerks.SCORM.API.get = function(){

    var API = null,
        win = window,
		scorm = pipwerks.SCORM,
        find = scorm.API.find,
        trace = pipwerks.UTILS.trace;

	try {
		if(win.parent && win.parent != win){
			API = find(win.parent);
		}

		if(!API && win.top.opener){
			API = find(win.top.opener);
		}

		//Special handling for Plateau
		//Thanks to Joseph Venditti for the patch
		if(!API && win.top.opener && win.top.opener.document) {
			API = find(win.top.opener.document);
		}
	}
	catch(e) {}

    if(API){
        scorm.API.isFound = true;
    } else {
        trace("API.get failed: Can't find the API!");
    }

    return API;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.API.getHandle()
   Returns the handle to API object if it was previously set

   Parameters:  None.
   Returns:     Object (the pipwerks.SCORM.API.handle variable).
---------------------------------------------------------------------------- */

pipwerks.SCORM.API.getHandle = function() {

    var API = pipwerks.SCORM.API;

    if(!API.handle && !API.isFound){

        API.handle = API.get();

    }

    return API.handle;

};



// ------------------------------------------------------------------------- //
// --- pipwerks.SCORM.connection functions --------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.connection.initialize()
   Tells the LMS to initiate the communication session.

   Parameters:  None
   Returns:     Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.connection.initialize = function(){

    var success = false,
        scorm = pipwerks.SCORM,
        completionStatus = scorm.data.completionStatus,
        trace = pipwerks.UTILS.trace,
        makeBoolean = pipwerks.UTILS.StringToBoolean,
        debug = scorm.debug,
        traceMsgPrefix = "SCORM.connection.initialize ";

    trace("connection.initialize called.");

    if(!scorm.connection.isActive){

        var API = scorm.API.getHandle(),
            errorCode = 0;

        if(API){

            switch(scorm.version){
                case "1.2" : success = makeBoolean(API.LMSInitialize("")); break;
                case "2004": success = makeBoolean(API.Initialize("")); break;
            }

            if(success){

                //Double-check that connection is active and working before returning 'true' boolean
                errorCode = debug.getCode();

                if(errorCode !== null && errorCode === 0){

                    scorm.connection.isActive = true;

                    if(scorm.handleCompletionStatus){

                        //Automatically set new launches to incomplete
                        completionStatus = scorm.status("get");

                        if(completionStatus){

                            switch(completionStatus){

                                //Both SCORM 1.2 and 2004
                                case "not attempted": scorm.status("set", "incomplete"); break;

                                //SCORM 2004 only
                                case "unknown" : scorm.status("set", "incomplete"); break;

                                //Additional options, presented here in case you'd like to use them
                                //case "completed"  : break;
                                //case "incomplete" : break;
                                //case "passed"     : break;    //SCORM 1.2 only
                                //case "failed"     : break;    //SCORM 1.2 only
                                //case "browsed"    : break;    //SCORM 1.2 only

                            }

                        }

                    }

                } else {

                    success = false;
                    trace(traceMsgPrefix +"failed. \nError code: " +errorCode +" \nError info: " +debug.getInfo(errorCode));

                }

            } else {

                errorCode = debug.getCode();

                if(errorCode !== null && errorCode !== 0){

                    trace(traceMsgPrefix +"failed. \nError code: " +errorCode +" \nError info: " +debug.getInfo(errorCode));

                } else {

                    trace(traceMsgPrefix +"failed: No response from server.");

                }
            }

        } else {

            trace(traceMsgPrefix +"failed: API is null.");

        }

    } else {

          trace(traceMsgPrefix +"aborted: Connection already active.");

     }

     return success;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.connection.terminate()
   Tells the LMS to terminate the communication session

   Parameters:  None
   Returns:     Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.connection.terminate = function(){

    var success = false,
        scorm = pipwerks.SCORM,
        exitStatus = scorm.data.exitStatus,
        completionStatus = scorm.data.completionStatus,
        trace = pipwerks.UTILS.trace,
        makeBoolean = pipwerks.UTILS.StringToBoolean,
        debug = scorm.debug,
        traceMsgPrefix = "SCORM.connection.terminate ";


    if(scorm.connection.isActive){

        var API = scorm.API.getHandle(),
            errorCode = 0;

        if(API){

             if(scorm.handleExitMode && !exitStatus){

                if(completionStatus !== "completed" && completionStatus !== "passed"){

                    switch(scorm.version){
                        case "1.2" : success = scorm.set("cmi.core.exit", "suspend"); break;
                        case "2004": success = scorm.set("cmi.exit", "suspend"); break;
                    }

                } else {

                    switch(scorm.version){
                        case "1.2" : success = scorm.set("cmi.core.exit", "logout"); break;
                        case "2004": success = scorm.set("cmi.exit", "normal"); break;
                    }

                }

            }

            switch(scorm.version){
                case "1.2" : success = makeBoolean(API.LMSFinish("")); break;
                case "2004": success = makeBoolean(API.Terminate("")); break;
            }

            if(success){

                scorm.connection.isActive = false;

            } else {

                errorCode = debug.getCode();
                trace(traceMsgPrefix +"failed. \nError code: " +errorCode +" \nError info: " +debug.getInfo(errorCode));

            }

        } else {

            trace(traceMsgPrefix +"failed: API is null.");

        }

    } else {

        trace(traceMsgPrefix +"aborted: Connection already terminated.");

    }

    return success;

};



// ------------------------------------------------------------------------- //
// --- pipwerks.SCORM.data functions --------------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.data.get(parameter)
   Requests information from the LMS.

   Parameter: parameter (string, name of the SCORM data model element)
   Returns:   string (the value of the specified data model element)
---------------------------------------------------------------------------- */

pipwerks.SCORM.data.get = function(parameter){

    var value = null,
        scorm = pipwerks.SCORM,
        trace = pipwerks.UTILS.trace,
        debug = scorm.debug,
        traceMsgPrefix = "SCORM.data.get(" +parameter +") ";

    if(scorm.connection.isActive){

        var API = scorm.API.getHandle(),
            errorCode = 0;

          if(API){

            switch(scorm.version){
                case "1.2" : value = API.LMSGetValue(parameter); break;
                case "2004": value = API.GetValue(parameter); break;
            }

            errorCode = debug.getCode();

            //GetValue returns an empty string on errors
            //If value is an empty string, check errorCode to make sure there are no errors
            if(value !== "" || errorCode === 0){

				//GetValue is successful.  
				//If parameter is lesson_status/completion_status or exit status, let's
				//grab the value and cache it so we can check it during connection.terminate()
                switch(parameter){

                    case "cmi.core.lesson_status":
                    case "cmi.completion_status" : scorm.data.completionStatus = value; break;

                    case "cmi.core.exit":
                    case "cmi.exit"     : scorm.data.exitStatus = value; break;

                }

            } else {

                trace(traceMsgPrefix +"failed. \nError code: " +errorCode +"\nError info: " +debug.getInfo(errorCode));

            }

        } else {

            trace(traceMsgPrefix +"failed: API is null.");

        }

    } else {

        trace(traceMsgPrefix +"failed: API connection is inactive.");

    }

    trace(traceMsgPrefix +" value: " +value);

    return String(value);

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.data.set()
   Tells the LMS to assign the value to the named data model element.
   Also stores the SCO's completion status in a variable named
   pipwerks.SCORM.data.completionStatus. This variable is checked whenever
   pipwerks.SCORM.connection.terminate() is invoked.

   Parameters: parameter (string). The data model element
               value (string). The value for the data model element
   Returns:    Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.data.set = function(parameter, value){

    var success = false,
        scorm = pipwerks.SCORM,
        trace = pipwerks.UTILS.trace,
        makeBoolean = pipwerks.UTILS.StringToBoolean,
        debug = scorm.debug,
        traceMsgPrefix = "SCORM.data.set(" +parameter +") ";


    if(scorm.connection.isActive){

        var API = scorm.API.getHandle(),
            errorCode = 0;

        if(API){

            switch(scorm.version){
                case "1.2" : success = makeBoolean(API.LMSSetValue(parameter, value)); break;
                case "2004": success = makeBoolean(API.SetValue(parameter, value)); break;
            }

            if(success){

                if(parameter === "cmi.core.lesson_status" || parameter === "cmi.completion_status"){

                    scorm.data.completionStatus = value;

                }

            } else {

                trace(traceMsgPrefix +"failed. \nError code: " +errorCode +". \nError info: " +debug.getInfo(errorCode));

            }

        } else {

            trace(traceMsgPrefix +"failed: API is null.");

        }

    } else {

        trace(traceMsgPrefix +"failed: API connection is inactive.");

    }

    return success;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.data.save()
   Instructs the LMS to persist all data to this point in the session

   Parameters: None
   Returns:    Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.data.save = function(){

    var success = false,
        scorm = pipwerks.SCORM,
        trace = pipwerks.UTILS.trace,
        makeBoolean = pipwerks.UTILS.StringToBoolean,
        traceMsgPrefix = "SCORM.data.save failed";


    if(scorm.connection.isActive){

        var API = scorm.API.getHandle();

        if(API){

            switch(scorm.version){
                case "1.2" : success = makeBoolean(API.LMSCommit("")); break;
                case "2004": success = makeBoolean(API.Commit("")); break;
            }

        } else {

            trace(traceMsgPrefix +": API is null.");

        }

    } else {

        trace(traceMsgPrefix +": API connection is inactive.");

    }

    return success;

};


pipwerks.SCORM.status = function (action, status){

    var success = false,
        scorm = pipwerks.SCORM,
        trace = pipwerks.UTILS.trace,
        traceMsgPrefix = "SCORM.getStatus failed",
        cmi = "";

    if(action !== null){

        switch(scorm.version){
            case "1.2" : cmi = "cmi.core.lesson_status"; break;
            case "2004": cmi = "cmi.completion_status"; break;
        }

        switch(action){

            case "get": success = scorm.data.get(cmi); break;

            case "set": if(status !== null){

                            success = scorm.data.set(cmi, status);

                        } else {

                            success = false;
                            trace(traceMsgPrefix +": status was not specified.");

                        }

                        break;

            default      : success = false;
                        trace(traceMsgPrefix +": no valid action was specified.");

        }

    } else {

        trace(traceMsgPrefix +": action was not specified.");

    }

    return success;

};


// ------------------------------------------------------------------------- //
// --- pipwerks.SCORM.debug functions -------------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.debug.getCode
   Requests the error code for the current error state from the LMS

   Parameters: None
   Returns:    Integer (the last error code).
---------------------------------------------------------------------------- */

pipwerks.SCORM.debug.getCode = function(){

    var scorm = pipwerks.SCORM,
        API = scorm.API.getHandle(),
        trace = pipwerks.UTILS.trace,
        code = 0;

    if(API){

        switch(scorm.version){
            case "1.2" : code = parseInt(API.LMSGetLastError(), 10); break;
            case "2004": code = parseInt(API.GetLastError(), 10); break;
        }

    } else {

        trace("SCORM.debug.getCode failed: API is null.");

    }

    return code;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.debug.getInfo()
   "Used by a SCO to request the textual description for the error code
   specified by the value of [errorCode]."

   Parameters: errorCode (integer).
   Returns:    String.
----------------------------------------------------------------------------- */

pipwerks.SCORM.debug.getInfo = function(errorCode){

    var scorm = pipwerks.SCORM,
        API = scorm.API.getHandle(),
        trace = pipwerks.UTILS.trace,
        result = "";


    if(API){

        switch(scorm.version){
            case "1.2" : result = API.LMSGetErrorString(errorCode.toString()); break;
            case "2004": result = API.GetErrorString(errorCode.toString()); break;
        }

    } else {

        trace("SCORM.debug.getInfo failed: API is null.");

    }

    return String(result);

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.debug.getDiagnosticInfo
   "Exists for LMS specific use. It allows the LMS to define additional
   diagnostic information through the API Instance."

   Parameters: errorCode (integer).
   Returns:    String (Additional diagnostic information about the given error code).
---------------------------------------------------------------------------- */

pipwerks.SCORM.debug.getDiagnosticInfo = function(errorCode){

    var scorm = pipwerks.SCORM,
        API = scorm.API.getHandle(),
        trace = pipwerks.UTILS.trace,
        result = "";

    if(API){

        switch(scorm.version){
            case "1.2" : result = API.LMSGetDiagnostic(errorCode); break;
            case "2004": result = API.GetDiagnostic(errorCode); break;
        }

    } else {

        trace("SCORM.debug.getDiagnosticInfo failed: API is null.");

    }

    return String(result);

};


// ------------------------------------------------------------------------- //
// --- Shortcuts! ---------------------------------------------------------- //
// ------------------------------------------------------------------------- //

// Because nobody likes typing verbose code.

pipwerks.SCORM.init = pipwerks.SCORM.connection.initialize;
pipwerks.SCORM.get  = pipwerks.SCORM.data.get;
pipwerks.SCORM.set  = pipwerks.SCORM.data.set;
pipwerks.SCORM.save = pipwerks.SCORM.data.save;
pipwerks.SCORM.quit = pipwerks.SCORM.connection.terminate;



// ------------------------------------------------------------------------- //
// --- pipwerks.UTILS functions -------------------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.UTILS.StringToBoolean()
   Converts 'boolean strings' into actual valid booleans.

   (Most values returned from the API are the strings "true" and "false".)

   Parameters: String
   Returns:    Boolean
---------------------------------------------------------------------------- */

pipwerks.UTILS.StringToBoolean = function(value){
    var t = typeof value;
    switch(t){
       //typeof new String("true") === "object", so handle objects as string via fall-through. 
	   //See https://github.com/pipwerks/scorm-api-wrapper/issues/3
	   case "object":  
       case "string": return (/(true|1)/i).test(value);
       case "number": return !!value;
       case "boolean": return value;
       case "undefined": return null;
       default: return false;
    }
};



/* -------------------------------------------------------------------------
   pipwerks.UTILS.trace()
   Displays error messages when in debug mode.

   Parameters: msg (string)
   Return:     None
---------------------------------------------------------------------------- */

pipwerks.UTILS.trace = function(msg){

     if(pipwerks.debug.isActive){

        if(window.console && window.console.log){
            console.log(msg);
        } else {
            //alert(msg);
        }

     }
};
module.exports.pipwerks = pipwerks
});

/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/** @file Stuff to do with loading XML, and getting data out of XML. Provides {@link Numbas.xml}. */

Numbas.queueScript('xml',['base','jme'],function() {

/** @namespace Numbas.xml */

var xml = Numbas.xml = {

	/** DOM parser to use to parse XML
	 * @type {DOMParser}
	 * @private
	 */
	dp: new DOMParser(),

	/** Load in all the XSLT/XML documents from {@link Numbas.rawxml} */
	loadXMLDocs: function()
	{
		var examXML = xml.examXML = xml.loadXML(Numbas.rawxml.examXML);

		var templates = xml.templates = {};
		for(var x in Numbas.rawxml.templates)
		{
			templates[x] = xml.loadXML(Numbas.rawxml.templates[x]);
			xml.localise(templates[x]);
		}
	},

	/** Load in a single XML document
	 * @param {string} xmlstring
	 * @returns {XMLDocument}
	 */
	loadXML: function(xmlstring)
	{
		//parse the XML document
		var doc = xml.dp.parseFromString(xmlstring,'text/xml');

		//check for errors
		if(Sarissa.getParseErrorText(doc) != Sarissa.PARSED_OK)
		{
			throw(new Numbas.Error('xml.could not load',Sarissa.getParseErrorText(doc)));
		}

		//allow XPath to be used to select nodes
		doc.setProperty('SelectionLanguage','XPath');

		//convert all the attribute names to lower case
		var es = doc.selectNodes('descendant::*');
		for(var i=0; i<es.length; i++)
		{
			var e = es[i];
			var attrs = [];
			var j=0;
			for(j=0; j< e.attributes.length; j++)
			{
				attrs.push(e.attributes[j].name);
			}
			for(j=0; j< attrs.length; j++)
			{
				var name = attrs[j];
				if(name!=name.toLowerCase())
				{
					var value = e.getAttribute(name);
					e.removeAttribute(name);
					e.setAttribute(name.toLowerCase(),value);
				}
			}
		}

		return doc;
	},

	/** @typedef func_data
	 * @type {object}
	 * @property {string} name
	 * @property {string} definition - definition, either in {@link JME} or JavaScript
	 * @property {string} language - either `jme` or `javascript`
	 * @property {string} outtype - name of the {@link Numbas.jme.token} type this function returns
	 * @property {object[]} parameters - dicts of `name` and `type` for the function's parameters.
	 */

	/** Load user-defined functions from an XML node
	 * @param {Element} xml
	 * @returns {func_data[]}
	 */
	loadFunctions: function(xml)
	{
		var tmpFunctions = [];

		//work out functions
		var functionNodes = xml.selectNodes('functions/function');
		if(!functionNodes)
			return {};

		//first pass: get function names and types
		for(var i=0; i<functionNodes.length; i++)
		{
			var name = functionNodes[i].getAttribute('name').toLowerCase();

			var definition = functionNodes[i].getAttribute('definition');
			var language = functionNodes[i].getAttribute('language');

			var outtype = functionNodes[i].getAttribute('outtype').toLowerCase();

			var parameterNodes = functionNodes[i].selectNodes('parameters/parameter');
			var parameters = [];
			for(var j=0; j<parameterNodes.length; j++)
			{
				parameters.push({
					name: parameterNodes[j].getAttribute('name'),
					type: parameterNodes[j].getAttribute('type').toLowerCase()
				});
			}
			tmpFunctions.push({
				name: name,
				definition: definition,
				language: language,
				outtype: outtype,
				parameters: parameters
			});

		}
		return tmpFunctions;
	},

	/** @typedef variable_data_dict
	 * @type {object}
	 * @property {Numbas.jme.tree} tree
	 * @property {string[]} vars - names of variables this variable depends on
	 */

	/** Load variable definitions from an XML node
	 * @param {Element} xml
	 * @param {Numbas.jme.Scope} - scope to compile relative to
	 * @returns {variable_data_dict[]}
	 */
	loadVariables: function(xml,scope) {
		var variableNodes = xml.selectNodes('variables/variable');	//get variable definitions out of XML
		if(!variableNodes)
			return {};

		//list of variable names to ignore because they don't make sense
		var ignoreVariables = ['pi','e','date','year','month','monthname','day','dayofweek','dayofweekname','hour24','hour','minute','second','msecond','firstcdrom'];

		//evaluate variables - work out dependency structure, then evaluate from definitions in correct order
		var todo = {};
		for( var i=0; i<variableNodes.length; i++ )
		{
			var name = variableNodes[i].getAttribute('name').toLowerCase();
			if(!ignoreVariables.contains(name))
			{
				var value = Numbas.xml.getTextContent(variableNodes[i].selectSingleNode('value'));

				var vars = [];

				if(value.trim()=='') {
					throw(new Numbas.Error('jme.variables.empty definition',name));
				}

				try {
					var tree = Numbas.jme.compile(value,scope,true);
				} catch(e) {
					throw(new Numbas.Error('xml.error in variable definition',name));
				}
				vars = vars.merge(Numbas.jme.findvars(tree));
				todo[name]={
					tree: tree,
					vars: vars
				};
			}
		}
		return todo;
	},


	/** Lots of the time we have a message stored inside content/html/.. structure.
	 *
	 * This pulls the message out and serializes it so it can be inserted easily with jQuery
	 * @param {Element} node
	 * @returns {string}
	 */
	serializeMessage: function(node)
	{
		return new XMLSerializer().serializeToString(node.selectSingleNode('content'));
	},

	/** Get all the text belonging to an element
	 * @param {Element} elem
	 * @returns {string}
	 */
	getTextContent: function(elem)
	{
		return $(elem).text();
	},

	/** Set the text content of an element
	 * @param {Element} elem
	 * @param {string} text
	 */
	setTextContent: function(elem,text)
	{
		if(elem.textContent!==undefined)
			elem.textContent = text;
		else
			elem.text = text;
	},

	/** Try to get attributes from an XML node, and use them to fill in an object's properties if they're present. If `obj` is null, then the loaded value is just returned.
	 * @param {object} obj - object to fill up
	 * @param {Element} xmlroot - root XML element
	 * @param {Element|string} elem - either an XML node to get attributes from, or an XPath query to get the element from `xmlroot`
	 * @param {string[]} names - names of attributes to load
	 * @param {string[]} [altnames] - names of object properties to associate with attribute names. If undefined, the attribute name is used.
	 * @param {object} options - `string` means always return the attribute as a string
	 * @returns {object} - last attribute loaded
	 */
	tryGetAttribute: function(obj,xmlroot,elem,names,altnames,options)
	{
		if(!options)
			options = {};

		if(typeof(elem)=='string')	//instead of passing in an XML node to use, can give an XPath query, and we try to get that from xmlroot
			elem = xmlroot.selectSingleNode(elem);
		if(!elem)
			return false;

		if(typeof(names)=='string')
			names=[names];

		if(!altnames)
			altnames=[];
		else if(typeof(altnames)=='string')
			altnames=[altnames];

		for(var i=0;i<names.length;i++)
		{
			var value = elem.getAttribute(names[i].toLowerCase());	//try to get attribute from node

			if(value!==null)
			{
				//establish which field of target object we're filling in
				var name = altnames[i] ? altnames[i] : names[i];
				if(options.string)
				{
				}
				//if this property is already defined in the target object, cast the loaded value to the same type as the existing value
				else if(obj!==null && obj[name]!==undefined)
				{
					if(value.length>0)
					{
						if(typeof(obj[name]) == 'number')
						{
							if(Numbas.util.isFloat(value))
								value = parseFloat(value);
							else if(Numbas.util.isFloat(Numbas.util.unPercent(value)))
							{
								value = Numbas.util.unPercent(value);
							}
							else
								throw(new Numbas.Error('xml.property not number',name,value,elem));
						}
						else if(typeof(obj[name]) == 'boolean')
						{
							if(Numbas.util.isBool(value))							
								value = Numbas.util.parseBool(value);
							else
								throw(new Numbas.Error('xml.property not boolean',name,value,elem));
						}
						//otherwise must be a string, so leave it alone
					}
				}
				else
				{
					//automatically convert to a number or a boolean if possible
					if(Numbas.util.isFloat(value))	
					{
						value = parseFloat(value);
					}
					else if(Numbas.util.isBool(value))
					{
						value = Numbas.util.parseBool(value);
					}
				}

				if(obj)
					obj[name] = value;
			}
		}
		return value;
	},

	/** Replace every `<localise>` tag with its contents, run through R.js, i.e. get localised strings.
	 * @param {Element} template
	 */
	localise: function(template) {
		$(template).find('localise').each(function() {
			var localString = R($(this).text());
			$(this).replaceWith(localString);
		});
		return template;
	}
};

});

/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/** @file Defines the {@link Numbas.Exam} object. */


Numbas.queueScript('exam',['base','timing','util','xml','display','schedule','storage','scorm-storage','math','question','jme-variables','jme-display','jme'],function() {
	var job = Numbas.schedule.add;

/** Keeps track of all info we need to know while exam is running.
 *
 * Loads XML from {@link Numbas.xml.examXML}
 * @constructor
 * @memberof Numbas
 */
function Exam()
{
	var tryGetAttribute = Numbas.xml.tryGetAttribute;

	//get the exam info out of the XML and into the exam object
	var xml = this.xml = Numbas.xml.examXML.selectSingleNode('/exam');
	if(!xml)
	{
		throw(new Numbas.Error('exam.xml.bad root'));
	}

	var settings = this.settings;

	//load settings from XML
	tryGetAttribute(settings,xml,'.',['name','percentPass']);
	tryGetAttribute(settings,xml,'questions',['shuffle','all','pick'],['shuffleQuestions','allQuestions','pickQuestions']);

	tryGetAttribute(settings,xml,'settings/navigation',['allowregen','reverse','browse','showfrontpage','preventleave'],['allowRegen','navigateReverse','navigateBrowse','showFrontPage','preventLeave']);

	//get navigation events and actions
	settings.navigationEvents = {};

	var navigationEventNodes = xml.selectNodes('settings/navigation/event');
	for( var i=0; i<navigationEventNodes.length; i++ )
	{
		var e = new ExamEvent(navigationEventNodes[i]);
		settings.navigationEvents[e.type] = e;
	}

	tryGetAttribute(settings,xml,'settings/timing',['duration','allowPause']);
	
	//get text representation of exam duration
	this.displayDuration = settings.duration>0 ? Numbas.timing.secsToDisplayTime( settings.duration ) : '';
						
	//get timing events
	settings.timerEvents = {};
	var timerEventNodes = this.xml.selectNodes('settings/timing/event');
	for( i=0; i<timerEventNodes.length; i++ )
	{
		var e = new ExamEvent(timerEventNodes[i]);
		settings.timerEvents[e.type] = e;
	}
		
	//feedback
	var feedbackPath = 'settings/feedback';
	tryGetAttribute(settings,xml,feedbackPath,['showactualmark','showtotalmark','showanswerstate','allowrevealanswer'],['showActualMark','showTotalMark','showAnswerState','allowRevealAnswer']);

	tryGetAttribute(settings,xml,feedbackPath+'/advice',['threshold'],['adviceGlobalThreshold']);	

	settings.numQuestions = xml.selectNodes('questions/question').length;

	var scopes = [Numbas.jme.builtinScope];
	for(var extension in Numbas.extensions) {
		if('scope' in Numbas.extensions[extension]) {
			scopes.push(Numbas.extensions[extension].scope);
		}
	}
	scopes.push({
		functions: Numbas.jme.variables.makeFunctions(this.xml,this.scope)
	});

	this.scope = new Numbas.jme.Scope(scopes);

	//rulesets
	var rulesetNodes = xml.selectNodes('settings/rulesets/set');
	this.scope.rulesets = Numbas.util.copyobj(Numbas.jme.display.simplificationRules);

	var sets = {};
	sets['default'] = ['unitFactor','unitPower','unitDenominator','zeroFactor','zeroTerm','zeroPower','collectNumbers','zeroBase','constantsFirst','sqrtProduct','sqrtDivision','sqrtSquare','otherNumbers'];
	for( i=0; i<rulesetNodes.length; i++)
	{
		var name = rulesetNodes[i].getAttribute('name');
		var set = [];

		//get new rule definitions
		defNodes = rulesetNodes[i].selectNodes('ruledef');
		for( var j=0; j<defNodes.length; j++ )
		{
			var pattern = defNodes[j].getAttribute('pattern');
			var result = defNodes[j].getAttribute('result');
			var conditions = [];
			var conditionNodes = defNodes[j].selectNodes('conditions/condition');
			for(var k=0; k<conditionNodes.length; k++)
			{
				conditions.push(Numbas.xml.getTextContent(conditionNodes[k]));
			}
			var rule = new Numbas.jme.display.Rule(pattern,conditions,result);
			set.push(rule);
		}

		//get included sets
		var includeNodes = rulesetNodes[i].selectNodes('include');
		for(var j=0; j<includeNodes.length; j++ )
		{
			set.push(includeNodes[j].getAttribute('name'));
		}

		sets[name] = this.scope.rulesets[name] = set;
	}

	for(var name in sets)
	{
		this.scope.rulesets[name] = Numbas.jme.collectRuleset(sets[name],this.scope.rulesets);
	}

	//initialise display
	this.display = new Numbas.display.ExamDisplay(this);

}
Numbas.Exam = Exam;
Exam.prototype = /** @lends Numbas.Exam.prototype */ {
	/** Settings
	 * @property {string} name - Title of exam
	 * @property {number} percentPass - Percentage of max. score student must achieve to pass 
	 * @property {boolean} shuffleQuestions - should the questions be shuffled?
	 * @property {number} numQuestions - number of questions in this sitting
	 * @property {boolean} preventLeave - prevent the browser from leaving the page while the exam is running?
	 * @property {boolean} allowRegen -can student re-randomise a question?
	 * @property {boolean} navigateReverse - can student navigate to previous question?
	 * @property {boolean} navigateBrowse - can student jump to any question they like?
	 * @property {boolean} showFrontPage - show the frontpage before starting the exam?
	 * @property {Array.object} navigationEvents - checks to perform when doing certain navigation action
	 * @property {Array.object} timerEvents - events based on timing
	 * @property {number} duration - how long is exam? (seconds)
	 * @property {boolean} allowPause - can the student suspend the timer with the pause button or by leaving?
	 * @property {boolean} showActualMark - show current score?
	 * @property {boolean} showTotalMark - show total marks in exam?
	 * @property {boolean} showAnswerState - tell student if answer is correct/wrong/partial?
	 * @property {boolean} allowRevealAnswer - allow 'reveal answer' button?
	 * @property {number} adviceGlobalThreshold - if student scores lower than this percentage on a question, the advice is displayed
	 */
	settings: {
		
		name: '',					
		percentPass: 0,				
		shuffleQuestions: false,	
		numQuestions: 0,			
		preventLeave: true,			
		allowRegen: false,			
		navigateReverse: false,		
		navigateBrowse: false,		
		showFrontPage: true,		
		navigationEvents: {},		
		timerEvents: {},			
		duration: 0,				
		allowPause: false,			
		showActualMark: false,		
		showTotalMark: false,		
		showAnswerState: false,		
		allowRevealAnswer: false,	
		adviceGlobalThreshold: 0, 	
	},

	/** Base node of exam XML
	 * @type Element
	 */
	xml: undefined,

	/**
	 * Can be
	 *  * `"normal"` - Student is currently sitting the exam
	 *  * `"review"` - Student is reviewing a completed exam
	 *  @type string
	 */
	mode: 'normal',				
                                
	/** Total marks available in the exam 
	 * @type number
	 */
	mark: 0,					

	/** Student's current score 
	 * @type number
	 */
	score: 0,					//student's current score

	/** Student's score as a percentage
	 * @type number
	 */
	percentScore: 0,
	
	/** Did the student pass the exam? 
	 * @type boolean
	 */
	passed: false,				//did student pass the exam?

	/** JME evaluation environment
	 *
	 * Contains variables, rulesets and functions defined by the exam and by extensions.
	 *
	 * Inherited by each {@link Numbas.Question}'s scope.
	 * @type Numbas.jme.Scope
	 */
	scope: undefined,

	/** Number of the current question
	 * @type number
	 */
	currentQuestionNumber: 0,
	/**
	 * Object representing the current question.
	 * @type Numbas.Question
	 */
	currentQuestion: undefined,
	
	/**
	 * Which questions are used?
	 * @type number[]
	 */
	questionSubset: [],
	/**
	 * Question objects, in the order the student will see them
	 * @type Numbas.Question[]
	 */
	questionList: [],			
		
	/** Exam duration in `h:m:s` format
	 * @type string
	 */
	displayDuration: '',
	/** Stopwatch object - updates the timer every second.
	 * @property {Date} start
	 * @property {Date} end
	 * @property {number} oldTimeSpent - `timeSpent` when the stopwatch was last updated
	 * @property {number} id - id of the `Interval` which calls {@link Numbas.Exam#countDown}
	 */
	stopwatch: undefined,
	/** Time that the exam should stop
	 * @type Date
	 */
	endTime: undefined,
	/** Seconds until the end of the exam
	 * @type number
	 */
	timeRemaining: 0,
	/** Seconds the exam has been in progress
	 * @type number
	 */
	timeSpent: 0,
	/** Is the exam in progress?
	 *
	 * `false` before starting, when paused, and after ending.
	 * @type boolean
	 */
	inProgress: false,

	/** Time the exam started
	 * @type Date
	 */
	start: Date(),
	/** Time the exam finished
	 * @type Date
	 */
	stop: Date(),
	

	/* Display object for this exam
	 * @type Numbas.display.ExamDisplay
	 */
	display: undefined,

	/** Stuff to do when starting exam afresh, before showing the front page.
	 */
	init: function()
	{
		var exam = this;
		var variablesTodo = Numbas.xml.loadVariables(exam.xml,exam.scope);
		exam.scope.variables = Numbas.jme.variables.makeVariables(variablesTodo,exam.scope)
		job(exam.chooseQuestionSubset,exam);			//choose questions to use
		job(exam.makeQuestionList,exam);				//create question objects
		job(Numbas.store.init,Numbas.store,exam);		//initialise storage
		job(Numbas.store.save,Numbas.store);			//make sure data get saved to LMS
	},

	/** Restore previously started exam from storage */
	load: function()
	{
		this.loading = true;
		var suspendData = Numbas.store.load(this);	//get saved info from storage

		job(function() {
			this.questionSubset = suspendData.questionSubset;
			this.settings.numQuestions = this.questionSubset.length;
			this.start = new Date(suspendData.start);
			if(this.settings.allowPause) {
				this.timeRemaining = this.settings.duration - (suspendData.duration-suspendData.timeRemaining);
			}
			else {
				this.endTime = new Date(this.start.getTime()+this.settings.duration*1000);
				this.timeRemaining = (this.endTime - new Date())/1000;
			}
			this.score = suspendData.score;
		},this);

		job(this.makeQuestionList,this,true);

		job(function() {
			if(suspendData.currentQuestion!==undefined)
				this.changeQuestion(suspendData.currentQuestion);
			this.loading = false;
		},this);
	},


	/** Decide which questions to use and in what order */
	chooseQuestionSubset: function()
	{
		//get all questions out of XML
		var tmpQuestionList = new Array();

		//shuffle questions?
		this.questionSubset = [];
		if(this.settings.shuffleQuestions)
		{
			this.questionSubset = Numbas.math.deal(this.settings.numQuestions);
		}
		else	//otherwise just pick required number of questions from beginning of list
		{
			this.questionSubset = Numbas.math.range(this.settings.numQuestions);
		}
		if(!this.settings.allQuestions) {
			this.questionSubset = this.questionSubset.slice(0,this.settings.pickQuestions);
			this.settings.numQuestions = this.settings.pickQuestions;
		}

		if(this.questionSubset.length==0)
		{
			Numbas.display.showAlert("This exam contains no questions! Check the .exam file for errors.");
		}
	},

	/**
	 * Having chosen which questions to use, make question list and create question objects
	 *
	 * If loading, need to restore randomised variables instead of generating anew
	 *
	 * @param {boolean} [loading=true]
	 */
	makeQuestionList: function(loading)
	{
		this.questionList = [];
		
		var questions = this.xml.selectNodes("questions/question");
		for(var i = 0; i<this.questionSubset.length; i++) 
		{
			job(function(i)
			{
				var question = new Numbas.Question( this, questions[this.questionSubset[i]], i, loading, this.scope );
				this.questionList.push(question);
			},this,i);
		}

		job(function() {
			//register questions with exam display
			this.display.initQuestionList();

			//calculate max marks available in exam
			this.mark = 0;

			//go through the questions and recalculate the part scores, then the question scores, then the exam score
			for( i=0; i<this.settings.numQuestions; i++ )
			{
				this.mark += this.questionList[i].marks;
			}
		},this);
	},

	/** 
	 * Show the given info page
	 * @param {string} page - Name of the page to show
	 */
	showInfoPage: function(page) {
		if(this.currentQuestion)
			this.currentQuestion.leave();
		this.display.showInfoPage(page);
	},
	
	/**
	 * Begin the exam - start timing, go to the first question
	 */
	begin: function()
	{
		this.start = new Date();        //make a note of when the exam was started
		this.endTime = new Date(this.start.getTime()+this.settings.duration*1000);	//work out when the exam should end
		this.timeRemaining = this.settings.duration;

		this.changeQuestion(0);			//start at the first question!

		this.updateScore();				//initialise score

		//set countdown going
		if(this.mode!='review')
			this.startTiming();

		this.display.showQuestion();	//display the current question

	},

	/**
	 * Pause the exam, and show the `suspend` page
	 */
	pause: function()
	{
		this.endTiming();
		this.display.showInfoPage('suspend');

		Numbas.store.pause();
	},

	/**
	 * Resume the exam
	 */
	resume: function()
	{
		this.startTiming();
		this.display.showQuestion();
	},

	/** 
	 * Set the stopwatch going
	 */
	startTiming: function()
	{
		this.inProgress = true;
		this.stopwatch = {
			start: new Date(),
			end: new Date((new Date()).getTime() + this.timeRemaining*1000),
			oldTimeSpent: this.timeSpent,
			id: setInterval(function(){exam.countDown();}, 1000)
		};

		if( this.settings.duration > 0 )
			this.display.showTiming();
			
		else
			this.display.hideTiming();

		var exam = this;
		this.countDown();
	},

	/**
	 * Calculate time remaining and end the exam when timer reaches zero
	 */
	countDown: function()
	{
		var t = new Date();
		this.timeSpent = this.stopwatch.oldTimeSpent + (t - this.stopwatch.start)/1000;

		if(this.settings.duration > 0)
		{
			this.timeRemaining = Math.ceil((this.stopwatch.end - t)/1000);
			this.display.showTiming();

			if(this.settings.duration > 300 && this.timeRemaining<300 && !this.showedTimeWarning)
			{
				this.showedTimeWarning = true;
				var e = this.settings.timerEvents['timedwarning'];
				if(e && e.action=='warn')
				{
					Numbas.display.showAlert(e.message);
				}
			}
			else if(this.timeRemaining<=0)
			{
				var e = this.settings.timerEvents['timeout'];
				if(e && e.action=='warn')
				{
					Numbas.display.showAlert(e.message);
				}
				this.end(true);
			}	
		}
	},

	/** Stop the stopwatch */
	endTiming: function()
	{
		this.inProgress = false;
		clearInterval( this.stopwatch.id );
	},


	/** Recalculate and display the student's total score. 
	 * @see Numbas.Exam#calculateScore
	 */
	updateScore: function()
	{
		this.calculateScore();
		this.display.showScore();
		Numbas.store.saveExam(this);
	},

	/** Calculate the student's score */
	calculateScore: function()
	{
		this.score=0;
		for(var i=0; i<this.questionList.length; i++)
			this.score += this.questionList[i].score;
		this.percentScore = Math.round(100*this.score/this.mark);
	},

	/**
	 * Call this when student wants to move between questions.
	 *
	 * Will check move is allowed and if so change question and update display
	 *
	 * @param {number} i - Number of the question to move to
	 * @see Numbas.Exam#changeQuestion
	 */
	tryChangeQuestion: function(i)
	{
		if(i<0 || i>=this.settings.numQuestions)
			return;

		if( ! (this.settings.navigateBrowse 	// is browse navigation enabled?
			|| (this.questionList[i].visited && this.settings.navigateReverse)	// if not, we can still move backwards to questions already seen if reverse navigation is enabled
			|| (i>this.currentQuestion.number && this.questionList[i-1].visited)	// or you can always move to the next question
		))
		{
			return;
		}

		var currentQuestion = this.currentQuestion;
		if(!currentQuestion)
			return;

		if(i==currentQuestion.number)
			return;

		var exam = this;
		function go()
		{
			exam.changeQuestion(i);
			exam.display.showQuestion();
		}

		if(currentQuestion.leavingDirtyQuestion()) {
		}
		else if(currentQuestion.answered || currentQuestion.revealed || currentQuestion.marks==0)
		{
			go();
		}
		else
		{
			var eventObj = this.settings.navigationEvents.onleave;
			switch( eventObj.action )
			{
			case 'none':
				go();
				break;
			case 'warnifunattempted':
				Numbas.display.showConfirm(eventObj.message+'<p>'+R('control.proceed anyway')+'</p>',go);
				break;
			case 'preventifunattempted':
				Numbas.display.showAlert(eventObj.message);
				break;
			}
		}
	},

	/**
	 * Change the current question. Student's can't trigger this without going through {@link Numbas.Exam#tryChangeQuestion}
	 *
	 * @param {number} i - Number of the question to move to
	 */
	changeQuestion: function(i)
	{
		if(this.currentQuestion) {
			this.currentQuestion.leave();
		}
		this.currentQuestion = this.questionList[i];
		if(!this.currentQuestion)
		{
			throw(new Numbas.Error('exam.changeQuestion.no questions'));
		}
		this.currentQuestion.visited = true;
		Numbas.store.changeQuestion(this.currentQuestion);
	},

	/**
	 * Show a question in review mode
	 *
	 * @param {number} i - Number of the question to show
	 */
	reviewQuestion: function(i) {
		this.changeQuestion(i);
		this.display.showQuestion();
	},

	/**
	 * Regenerate the current question
	 */
	regenQuestion: function()
	{
		var e = this;
		var n = e.currentQuestion.number;
		job(e.display.startRegen,e.display);
		job(function() {
			var on = e.questionSubset.indexOf(n);
			e.questionList[n] = new Numbas.Question(e, e.xml.selectNodes('questions/question')[on], n, false, e.scope);
		})
		job(function() {
			e.changeQuestion(n);
			e.currentQuestion.display.init();
			e.display.showQuestion();
		});
		job(e.display.endRegen,e.display);
	},

	/**
	 * Try to end the exam - shows confirmation dialog, and checks that all answers have been submitted.
	 * @see Numbas.Exam#end
	 */
	tryEnd: function() {
		var message = R('control.confirm end');
		var answeredAll = true;
		var submittedAll = true;
		for(var i=0;i<this.questionList.length;i++) {
			if(!this.questionList[i].answered) {
				answeredAll = false;
				break;
			}
			if(this.questionList[i].isDirty()) {
				submittedAll = false;
			}
		}
		if(this.currentQuestion.leavingDirtyQuestion())
			return;
		if(!answeredAll) {
			message = R('control.not all questions answered') + '<br/>' + message;
		}
		else if(!submittedAll) {
			message = R('control.not all questions submitted') + '<br/>' + message;
		}
		Numbas.display.showConfirm(
			message,
			function() {
				job(Numbas.exam.end,Numbas.exam,true);
			}
		);
	},

	/**
	 * End the exam. The student can't directly trigger this without going through {@link Numbas.Exam#tryEnd}
	 */
	end: function(save)
	{
		this.mode = 'review';

		//work out summary info
		this.passed = (this.percentScore >= this.settings.percentPass*100);
		this.result = R(this.passed ? 'exam.passed' :'exam.failed')

		if(save) {
			//get time of finish
			this.stop = new Date();

			//stop the stopwatch
			this.endTiming();

			//send result to LMS, and tell it we're finished
			Numbas.store.end();
		}

		//display the results
		this.display.end();
		this.display.showInfoPage( 'result' );

		for(var i=0;i<this.questionList.length;i++) {
			this.questionList[i].revealAnswer(true);
		}
	},

	/**
	 * Exit the exam - show the `exit` page
	 */
	exit: function()
	{
		this.display.showInfoPage('exit');
	}
};

/** Represents what should happen when a particular timing or navigation event happens
 * @param Element eventNode - XML to load settings from
 * @constructor
 * @memberof Numbas
 */
function ExamEvent(eventNode)
{
	var tryGetAttribute = Numbas.xml.tryGetAttribute;
	tryGetAttribute(this,null,eventNode,['type','action']);
	this.message = Numbas.xml.serializeMessage(eventNode);
}
ExamEvent.prototype = /** @lends Numbas.ExamEvent.prototype */ {
	/** Name of the event this corresponds to 
	 *
	 * Navigation events:
	 * * `onleave` - the student tries to move to another question without answering the current one.
	 *
	 * (there used to be more, but now they're all the same one)
	 *
	 * Timer events:
	 * * `timedwarning` - Five minutes until the exam ends.
	 * * `timeout` - There's no time left; the exam is over.
	 * @memberof Numbas.ExamEvent
	 * @instance
	 * @type string 
	 */
	type: '',

	/** Action to take when the event happens.
	 *
	 * Choices for timer events:
	 * * `none` - don't do anything
	 * * `warn` - show a message
	 *
	 * Choices for navigation events:
	 * * `none` - just allow the navigation
	 * * `warnifunattempted` - Show a warning but allow the student to continue.
	 * * `preventifunattempted` - Show a warning but allow the student to continue.
	 * @memberof Numbas.ExamEvent
	 * @instance
	 * @type string
	 */
	action: 'none',

	/** Message to show the student when the event happens.
	 * @memberof Numbas.ExamEvent
	 * @instance
	 * @type string
	 */
	message: ''
};

});

﻿Numbas.queueScript('seedrandom',[],function(module) {
// seedrandom.js version 2.0.
// Author: David Bau 4/2/2011
//
// Defines a method Math.seedrandom() that, when called, substitutes
// an explicitly seeded RC4-based algorithm for Math.random().  Also
// supports automatic seeding from local or network sources of entropy.
//
// Usage:
//
//   <script src=http://davidbau.com/encode/seedrandom-min.js></script>
//
//   Math.seedrandom('yipee'); Sets Math.random to a function that is
//                             initialized using the given explicit seed.
//
//   Math.seedrandom();        Sets Math.random to a function that is
//                             seeded using the current time, dom state,
//                             and other accumulated local entropy.
//                             The generated seed string is returned.
//
//   Math.seedrandom('yowza', true);
//                             Seeds using the given explicit seed mixed
//                             together with accumulated entropy.
//
//   <script src="http://bit.ly/srandom-512"></script>
//                             Seeds using physical random bits downloaded
//                             from random.org.
//
//   <script src="https://jsonlib.appspot.com/urandom?callback=Math.seedrandom">
//   </script>                 Seeds using urandom bits from call.jsonlib.com,
//                             which is faster than random.org.
//
// Examples:
//
//   Math.seedrandom("hello");            // Use "hello" as the seed.
//   document.write(Math.random());       // Always 0.5463663768140734
//   document.write(Math.random());       // Always 0.43973793770592234
//   var rng1 = Math.random;              // Remember the current prng.
//
//   var autoseed = Math.seedrandom();    // New prng with an automatic seed.
//   document.write(Math.random());       // Pretty much unpredictable.
//
//   Math.random = rng1;                  // Continue "hello" prng sequence.
//   document.write(Math.random());       // Always 0.554769432473455
//
//   Math.seedrandom(autoseed);           // Restart at the previous seed.
//   document.write(Math.random());       // Repeat the 'unpredictable' value.
//
// Notes:
//
// Each time seedrandom('arg') is called, entropy from the passed seed
// is accumulated in a pool to help generate future seeds for the
// zero-argument form of Math.seedrandom, so entropy can be injected over
// time by calling seedrandom with explicit data repeatedly.
//
// On speed - This javascript implementation of Math.random() is about
// 3-10x slower than the built-in Math.random() because it is not native
// code, but this is typically fast enough anyway.  Seeding is more expensive,
// especially if you use auto-seeding.  Some details (timings on Chrome 4):
//
// Our Math.random()            - avg less than 0.002 milliseconds per call
// seedrandom('explicit')       - avg less than 0.5 milliseconds per call
// seedrandom('explicit', true) - avg less than 2 milliseconds per call
// seedrandom()                 - avg about 38 milliseconds per call
//
// LICENSE (BSD):
//
// Copyright 2010 David Bau, all rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
// 
//   1. Redistributions of source code must retain the above copyright
//      notice, this list of conditions and the following disclaimer.
//
//   2. Redistributions in binary form must reproduce the above copyright
//      notice, this list of conditions and the following disclaimer in the
//      documentation and/or other materials provided with the distribution.
// 
//   3. Neither the name of this module nor the names of its contributors may
//      be used to endorse or promote products derived from this software
//      without specific prior written permission.
// 
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
/**
 * All code is in an anonymous closure to keep the global namespace clean.
 *
 * @param {number=} overflow 
 * @param {number=} startdenom
 */
(function (pool, math, width, chunks, significance, overflow, startdenom) {


//
// seedrandom()
// This is the seedrandom function described above.
//
math['seedrandom'] = function seedrandom(seed, use_entropy) {
  var key = [];
  var arc4;

  // Flatten the seed string or build one from local entropy if needed.
  seed = mixkey(flatten(
    use_entropy ? [seed, pool] :
    arguments.length ? seed :
    [new Date().getTime(), pool, window], 3), key);

  // Use the seed to initialize an ARC4 generator.
  arc4 = new ARC4(key);

  // Mix the randomness into accumulated entropy.
  mixkey(arc4.S, pool);

  // Override Math.random

  // This function returns a random double in [0, 1) that contains
  // randomness in every bit of the mantissa of the IEEE 754 value.

  math['random'] = function random() {  // Closure to return a random double:
    var n = arc4.g(chunks);             // Start with a numerator n < 2 ^ 48
    var d = startdenom;                 //   and denominator d = 2 ^ 48.
    var x = 0;                          //   and no 'extra last byte'.
    while (n < significance) {          // Fill up all significant digits by
      n = (n + x) * width;              //   shifting numerator and
      d *= width;                       //   denominator and generating a
      x = arc4.g(1);                    //   new least-significant-byte.
    }
    while (n >= overflow) {             // To avoid rounding up, before adding
      n /= 2;                           //   last byte, shift everything
      d /= 2;                           //   right using integer math until
      x >>>= 1;                         //   we have exactly the desired bits.
    }
    return (n + x) / d;                 // Form the number within [0, 1).
  };

  // Return the seed that was used
  return seed;
};

//
// ARC4
//
// An ARC4 implementation.  The constructor takes a key in the form of
// an array of at most (width) integers that should be 0 <= x < (width).
//
// The g(count) method returns a pseudorandom integer that concatenates
// the next (count) outputs from ARC4.  Its return value is a number x
// that is in the range 0 <= x < (width ^ count).
//
/** @constructor */
function ARC4(key) {
  var t, u, me = this, keylen = key.length;
  var i = 0, j = me.i = me.j = me.m = 0;
  me.S = [];
  me.c = [];

  // The empty key [] is treated as [0].
  if (!keylen) { key = [keylen++]; }

  // Set up S using the standard key scheduling algorithm.
  while (i < width) { me.S[i] = i++; }
  for (i = 0; i < width; i++) {
    t = me.S[i];
    j = lowbits(j + t + key[i % keylen]);
    u = me.S[j];
    me.S[i] = u;
    me.S[j] = t;
  }

  // The "g" method returns the next (count) outputs as one number.
  me.g = function getnext(count) {
    var s = me.S;
    var i = lowbits(me.i + 1); var t = s[i];
    var j = lowbits(me.j + t); var u = s[j];
    s[i] = u;
    s[j] = t;
    var r = s[lowbits(t + u)];
    while (--count) {
      i = lowbits(i + 1); t = s[i];
      j = lowbits(j + t); u = s[j];
      s[i] = u;
      s[j] = t;
      r = r * width + s[lowbits(t + u)];
    }
    me.i = i;
    me.j = j;
    return r;
  };
  // For robust unpredictability discard an initial batch of values.
  // See http://www.rsa.com/rsalabs/node.asp?id=2009
  me.g(width);
}

//
// flatten()
// Converts an object tree to nested arrays of strings.
//
/** @param {Object=} result 
  * @param {string=} prop
  * @param {string=} typ */
function flatten(obj, depth, result, prop, typ) {
  result = [];
  typ = typeof(obj);
  if (depth && typ == 'object') {
    for (prop in obj) {
      if (prop.indexOf('S') < 5) {    // Avoid FF3 bug (local/sessionStorage)
        try { result.push(flatten(obj[prop], depth - 1)); } catch (e) {}
      }
    }
  }
  return (result.length ? result : obj + (typ != 'string' ? '\0' : ''));
}

//
// mixkey()
// Mixes a string seed into a key that is an array of integers, and
// returns a shortened string seed that is equivalent to the result key.
//
/** @param {number=} smear 
  * @param {number=} j */
function mixkey(seed, key, smear, j) {
  seed += '';                         // Ensure the seed is a string
  smear = 0;
  for (j = 0; j < seed.length; j++) {
    key[lowbits(j)] =
      lowbits((smear ^= key[lowbits(j)] * 19) + seed.charCodeAt(j));
  }
  seed = '';
  for (j in key) { seed += String.fromCharCode(key[j]); }
  return seed;
}

//
// lowbits()
// A quick "n mod width" for width a power of 2.
//
function lowbits(n) { return n & (width - 1); }

//
// The following constants are related to IEEE 754 limits.
//
startdenom = math.pow(width, chunks);
significance = math.pow(2, significance);
overflow = significance * 2;

//
// When seedrandom.js is loaded, we immediately mix a few bits
// from the built-in RNG into the entropy pool.  Because we do
// not want to intefere with determinstic PRNG state later,
// seedrandom will not call math.random on its own again after
// initialization.
//
mixkey(math.random(), pool);

// End anonymous scope, and pass initial values.
})(
  [],   // pool: entropy pool starts empty
  Math, // math: package containing random, pow, and seedrandom
  256,  // width: each RC4 output is 0 <= x < 256
  6,    // chunks: at least six RC4 outputs for each double
  52    // significance: there are 52 significant digits in a double
);

});

/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/** @file The {@link Numbas.Question} object, and {@link Numbas.parts} */

Numbas.queueScript('question',['base','schedule','display','jme','jme-variables','xml','util','scorm-storage'],function() {

var util = Numbas.util;
var jme = Numbas.jme;
var math = Numbas.math;

var job = Numbas.schedule.add;

var tryGetAttribute = Numbas.xml.tryGetAttribute;

/** A unique identifier for a {@link Numbas.parts.Part} object, of the form `qXpY[gZ|sZ]`. Numbering starts from zero, and the `gZ` bit is used only when the part is a gap, and `sZ` is used if it's a step.
 * @typedef partpath
 * @type {string}
 */

/** Keeps track of all info to do with an instance of a single question
 *
 * @constructor
 * @memberof Numbas
 * @param {Numbas.Exam} exam - parent exam
 * @param {Element} xml
 * @param {number} number - index of this question in the exam (starting at 0)
 * @param {boolean} loading - is this question being resumed from an existing session?
 * @param {Numbas.jme.Scope} gscope - global JME scope
 */
var Question = Numbas.Question = function( exam, xml, number, loading, gscope)
{
	var q = question = this;
	q.exam = exam;
	q.adviceThreshold = q.exam.adviceGlobalThreshold;
	q.xml = xml;
	q.originalXML = q.xml;
	q.number = number;
	q.scope = new jme.Scope(gscope);
	q.preamble = {
		'js': '',
		'css': ''
	};
	q.callbacks = {
		HTMLAttached: [],
		variablesGenerated: []
	};

	//get question's name
	tryGetAttribute(q,q.xml,'.','name');

	job = function(fn,that) {
		function handleError(e) {
			e.message = R('question.error',q.number+1,e.message);
			throw(e);
		}
		Numbas.schedule.add({task: fn, error: handleError},that);
	}

	if(loading)
	{
		// check the suspend data was for this question - if the test is updated and the question set changes, this won't be the case!
		var qobj = Numbas.store.loadQuestion(q);

		if(qobj.name && qobj.name!=q.name) {
			throw(new Numbas.Error('question.loaded name mismatch'));
		}
	}

	job(function() {
		var preambleNodes = q.xml.selectNodes('preambles/preamble');
		for(var i = 0; i<preambleNodes.length; i++) {
			var lang = preambleNodes[i].getAttribute('language');
			q.preamble[lang] = Numbas.xml.getTextContent(preambleNodes[i]);
		}

		q.runPreamble();
	});

	job(function() {
		var functionsTodo = Numbas.xml.loadFunctions(q.xml,q.scope);
		q.scope.functions = Numbas.jme.variables.makeFunctions(functionsTodo,q.scope);
		//make rulesets
		var rulesetNodes = q.xml.selectNodes('rulesets/set');

		var sets = {};
		sets['default'] = ['unitFactor','unitPower','unitDenominator','zeroFactor','zeroTerm','zeroPower','collectNumbers','zeroBase','constantsFirst','sqrtProduct','sqrtDivision','sqrtSquare','otherNumbers'];
		for(var i=0; i<rulesetNodes.length; i++)
		{
			var name = rulesetNodes[i].getAttribute('name');
			var set = [];

			//get new rule definitions
			defNodes = rulesetNodes[i].selectNodes('ruledef');
			for( var j=0; j<defNodes.length; j++ )
			{
				var pattern = defNodes[j].getAttribute('pattern');
				var result = defNodes[j].getAttribute('result');
				var conditions = [];
				var conditionNodes = defNodes[j].selectNodes('conditions/condition');
				for(var k=0; k<conditionNodes.length; k++)
				{
					conditions.push(Numbas.xml.getTextContent(conditionNodes[k]));
				}
				var rule = new Numbas.jme.display.Rule(pattern,conditions,result);
				set.push(rule);
			}

			//get included sets
			var includeNodes = rulesetNodes[i].selectNodes('include');
			for(var j=0; j<includeNodes.length; j++ )
			{
				set.push(includeNodes[j].getAttribute('name'));
			}

			sets[name] = set;
		}

		for(var name in sets)
		{
			q.scope.rulesets[name] = Numbas.jme.collectRuleset(sets[name],q.scope.rulesets);
		}
	});

	job(function() {
		if(loading)
		{
			var qobj = Numbas.store.loadQuestion(q);
			for(var x in qobj.variables)
			{
				q.scope.variables[x] = qobj.variables[x];
			}
		}
		else
		{
			var variablesTodo = Numbas.xml.loadVariables(q.xml,q.scope);
			q.variablesTest = {
				condition: '',
				maxRuns: 10
			};
			tryGetAttribute(q.variablesTest,q.xml,'variables',['condition','maxRuns'],[]);
			var conditionSatisfied = false;
			var condition = jme.compile(q.variablesTest.condition);
			var runs = 0;
			var scope;
			while(runs<q.variablesTest.maxRuns && !conditionSatisfied) {
				runs += 1;
				scope = new jme.Scope([q.scope]);
				scope.variables = jme.variables.makeVariables(variablesTodo,q.scope);
				if(condition) {
					conditionSatisfied = jme.evaluate(condition,scope).value;
				} else {
					conditionSatisfied = true;
				}
			}
			if(runs==q.variablesTest.maxRuns) {
				throw(new Numbas.Error('jme.variables.question took too many runs to generate variables'));
			} else {
				q.scope = scope;
			}
		}
	
		q.scope = new jme.Scope([gscope,q.scope]);

		q.unwrappedVariables = {};
		for(var name in q.scope.variables) {
			q.unwrappedVariables[name] = Numbas.jme.unwrapValue(q.scope.variables[name]);
		}

		q.runCallbacks('variablesGenerated');
	});

	job(this.subvars,this);

	job(function()
	{
		//initialise display - get question HTML, make menu item, etc.
		q.display = new Numbas.display.QuestionDisplay(q);
	});

	job(function() 
	{
		//load parts
		q.parts=new Array();
		q.partDictionary = {};
		var parts = q.xml.selectNodes('parts/part');
		for(var j = 0; j<parts.length; j++)
		{
			var part = createPart(parts[j], 'p'+j,q,null, loading);
			q.parts[j] = part;
			q.marks += part.marks;
		}

		q.display.makeHTML();

		q.runCallbacks('HTMLAttached');

		if(loading)
		{
			var qobj = Numbas.store.loadQuestion(q);

			q.adviceDisplayed = qobj.adviceDisplayed;
			q.answered = qobj.answered;
			q.revealed = qobj.revealed;
			q.submitted = qobj.submitted;
			q.visited = qobj.visited;
			q.score = qobj.score;

			if(q.revealed)
				q.revealAnswer(true);
			else if(q.adviceDisplayed)
				q.getAdvice(true);

			for(var j=0;j<q.parts.length;j++) {
				q.parts[j].display.restoreAnswer();
			}
		}

		q.updateScore();
		
		q.display.showScore();
	});

}
Question.prototype = /** @lends Numbas.Question.prototype */ 
{
	/** XML definition of this question 
	 * @type {Element}
	 */
	xml: null,
	/** Position of this question in the exam
	 * @type {number}
	 */
	number: -1,
	/** Name - shouldn't be shown to students
	 * @type {string}
	 */
	name: '',
	
	/** Maximum marks available for this question
	 * @type {number}
	 */
	marks: 0,

	/** Student's score on this question
	 * @type {number}
	 */
	score: 0,

	/** Percentage score below which the advice is revealed
	 * @type {number}
	 */
	adviceThreshold: 0,

	/** Has this question been seen by the student? For determining if you can jump back to this question, when {@link Numbas.Question.navigateBrowse} is disabled.
	 * @type {boolean}
	 */
	visited: false,

	/** Has this question been answered satisfactorily?
	 * @type {boolean}
	 */
	answered: false,

	/** Number of times this question has been submitted.
	 * @type {number}
	 */
	submitted: 0,

	/** Has the advice been displayed?
	 * @type {boolean}
	 */
	adviceDisplayed: false,

	/** Have correct answers been revealed?
	 * @type {boolean}
	 */
	revealed: false,

	/** Parts belonging to this question, in the order they're displayed.
	 * @type {Numbas.parts.Part}
	 */
	parts: [],

	/** Dictionary mapping part addresses (of the form `qXpY[gZ]`) to {@link Numbas.parts.Part} objects.
	 * @type {object}
	 */
	partDictionary: {},

	/** Associated display object
	 * @type {Numbas.display.QuestionDisplay}
	 */
	display: undefined,

	/** Callbacks to run when the question's HTML is attached to the page
	 * @type {object.Array.<function>}
	 */
	callbacks: {
		HTMLAttached: [],
		variablesGenerated: []
	},

	/** Run the callbacks for a given event
	 *
	 * @param {string} name - name of the event
	 */
	runCallbacks: function(name) {
		var callbacks = this.callbacks[name];
		for(var i=0;i<callbacks.length;i++) {
			callbacks[i](this);
		}
	},

	/** Leave this question - called when moving to another question, or showing an info page. 
	 * @see Numbas.display.QuestionDisplay.leave
	 */
	leave: function() {
		this.display.leave();
	},

	/** Execute the question's JavaScript preamble - should happen as soon as the configuration has been loaded from XML, before variables are generated. */
	runPreamble: function() {
		with({
			question: this
		}) {
			var js = '(function() {'+this.preamble.js+'\n})()';
			try{
				eval(js);
			} catch(e) {
				var errorName = e.name=='SyntaxError' ? 'question.preamble.syntax error' : 'question.preamble.error';
				throw(new Numbas.Error(errorName,this.number+1,e.message));
			}
		}
	},

	/** Substitute the question's variables into its XML - clones the XML so the original is untouched.
	 */
	subvars: function()
	{
		var q = this;
		var doc = Sarissa.getDomDocument();
		doc.appendChild(q.originalXML.cloneNode(true));	//get a fresh copy of the original XML, to sub variables into
		q.xml = doc.selectSingleNode('question');
		q.xml.setAttribute('number',q.number);

		job(function() {
			//sub vars into math nodes
			var mathsNodes = q.xml.selectNodes('descendant::math');
			for( i=0; i<mathsNodes.length; i++ )
			{
				var expr = Numbas.xml.getTextContent(mathsNodes[i]);
				expr = jme.subvars(expr,q.scope);
				Numbas.xml.setTextContent(mathsNodes[i],expr);
			}
			//turn content maths into LaTeX
			mathsNodes = q.xml.selectNodes('descendant::content/descendant::math');
			for( i=0; i<mathsNodes.length; i++ )
			{
				var expr = Numbas.xml.getTextContent(mathsNodes[i]);
				expr = jme.subvars(expr,q.scope);
				var tex = jme.display.exprToLaTeX(expr,null,q.scope);
				Numbas.xml.setTextContent( mathsNodes[i], tex );
			}

			//sub into question name
			q.name = jme.subvars(q.name,q.scope);
		});
	},

	/** Get the part object corresponding to a path
	 * @param {partpath} path
	 * @returns {Numbas.parts.Part}
	 */
	getPart: function(path)
	{
		return this.partDictionary[path];
	},

	/** Show the question's advice
	 * @param {boolean} dontStore - Don't tell the storage that the advice has been shown - use when loading from storage!
	 */
	getAdvice: function(dontStore)
	{
		this.adviceDisplayed = true;
		this.display.showAdvice(true);
		if(!dontStore)
			Numbas.store.adviceDisplayed(this);
	},

	/** Reveal the correct answers to the student
	 * @param {booelan} dontStore - Don't tell the storage that the advice has been shown - use when loading from storage!
	 */
	revealAnswer: function(dontStore)
	{
		this.revealed = true;
		
		//display advice if allowed
		this.getAdvice(dontStore);

		//part-specific reveal code. Might want to do some logging in future? 
		for(var i=0; i<this.parts.length; i++)
			this.parts[i].revealAnswer(dontStore);

		//display revealed answers
		this.display.end();
		this.display.revealAnswer();

		this.display.showScore();

		if(!dontStore) {
			Numbas.store.answerRevealed(this);
		}

		this.exam.updateScore();
	},

	/** Validate the student's answers to the question. True if all parts are either answered or have no marks available.
	 * @returns {boolean}
	 */
	validate: function()
	{
		var success = true;
		for(i=0; i<this.parts.length; i++)
		{
			success = success && (this.parts[i].answered || this.parts[i].marks==0);
		}
		return success;
	},

	/** Has anything been changed since the last submission? If any part has `isDirty` set to true, return true.
	 * @returns {boolean}
	 */
	isDirty: function()
	{
		for(var i=0;i<this.parts.length; i++) {
			if(this.parts[i].isDirty)
				return true;
		}
		return false;
	},

	/** Show a warning and return true if the question is dirty.
	 * @see Numbas.Question.isDirty
	 * @returns {boolean}
	 */
	leavingDirtyQuestion: function() {
		if(this.answered && this.isDirty()) {
			Numbas.display.showAlert(R(this.parts.length>1 ? 'question.unsubmitted changes.several parts' : 'question.unsubmitted changes.one part'));
			return true;
		}
	},

	/** Mark the student's answer to a given part/gap/step.
	 */
	doPart: function(answerList, partRef)
	{
		var part = this.getPart(partRef);
		if(!part)
			throw(new Numbas.Error('question.no such part',partRef));
		part.storeAnswer(answerList);
	},

	/** Calculate the student's total score for this questoin - adds up all part scores 
	 */
	calculateScore: function()
	{
		var tmpScore=0;
		var answered = true;
		for(var i=0; i<this.parts.length; i++)
		{
			tmpScore += this.parts[i].score;
			answered = answered && this.parts[i].answered;
		}
		this.answered = answered;
		
		this.score = tmpScore;
	},


	/** Submit every part in the question */
	submit: function()
	{
		//submit every part
		for(var i=0; i<this.parts.length; i++)
		{
			this.parts[i].submit();
		}

		//validate every part
		//displays warning messages if appropriate, 
		//and returns false if any part is not completed sufficiently
		this.answered = this.validate();

		//keep track of how many times question successfully submitted
		if(this.answered)
			this.submitted += 1;

		//display message about success or failure
		if(! this.answered )
		{
			Numbas.display.showAlert(R('question.can not submit'));
			this.display.scrollToError();
		}

							
		this.updateScore();

		if(this.exam.adviceType == 'threshold' && 100*this.score/this.marks < this.adviceThreshold )
		{
			this.getAdvice();
		}
		Numbas.store.questionSubmitted(this);
	},

	/** Recalculate the student's score, update the display, and notify storage. */
	updateScore: function()
	{
		//calculate score - if warning is uiPrevent then score is 0
		this.calculateScore('uwNone');

		//update total exam score
		this.exam.updateScore();

		//display score - ticks and crosses etc.
		this.display.showScore();

		//notify storage
		Numbas.store.saveQuestion(this);
	},

	/** Add a callback function to run when the question's HTML is attached to the page
	 *
	 * @param {function} fn
	 */
	onHTMLAttached: function(fn) {
		this.callbacks.HTMLAttached.push(fn);
	},

	/** Add a callback function to run when the question's variables are generated (but before the HTML is attached)
	 *
	 * @param {function} fn
	 */
	onVariablesGenerated: function(fn) {
		this.callbacks.variablesGenerated.push(fn);
	}
};


/** Create a new question part. Automatically picks the right constructor based on the type defined in the XML.
 * @param {Element} xml
 * @param {partpath} path
 * @param {Numbas.Question} question
 * @param {Numbas.parts.Part} parentPart
 * @param {boolean} loading
 * @returns {Numbas.parts.Part}
 * @throws {NumbasError} "part.missing type attribute" if the top node in `xml` doesn't have a "type" attribute.
 * @memberof Numbas
 */
function createPart(xml, path, question, parentPart, loading)
{
	var type = tryGetAttribute(null,xml,'.','type',[]);
	if(type==null)
		throw(new Numbas.Error('part.missing type attribute'));
	if(partConstructors[type])
	{
		var cons = partConstructors[type];
		var part = new cons(xml, path, question, parentPart, loading);
		if(part.customConstructor) {
			part.customConstructor.apply(part);
		}
		if(loading && part.answered) {
			part.submit();
		}
		return part;
	}
	else
	{
		throw(new Numbas.Error('part.unknown type',type));
	}
}

/** Question part types
 * @namespace Numbas.parts */

/** Base question part object
 * @constructor
 * @memberof Numbas.parts
 * @param {Element} xml
 * @param {partpath} path
 * @param {Numbas.Question} Question
 * @param {Numbas.parts.Part} parentPart
 * @param {boolean} loading
 * @see {Numbas.createPart}
 */
function Part( xml, path, question, parentPart, loading )
{
	//remember XML
	this.xml = xml;

	//remember parent question object
	this.question = question;

	//remember parent part object, so scores can percolate up for steps/gaps
	this.parentPart = parentPart;
	
	//remember a path for this part, for stuff like marking and warnings
	this.path = path;
	this.question.partDictionary[path] = this;

	//initialise settings object
	this.settings = util.copyobj(Part.prototype.settings);
	
	tryGetAttribute(this,this.xml,'.',['type','marks']);

	tryGetAttribute(this.settings,this.xml,'.',['minimumMarks','enableMinimumMarks','stepsPenalty','showCorrectAnswer'],[]);

	//initialise gap and step arrays
	this.gaps = [];
	this.steps = [];

	//load steps
	var stepNodes = xml.selectNodes('steps/part');
	for(var i=0; i<stepNodes.length; i++)
	{
		var step = createPart( stepNodes[i], this.path+'s'+i,this.question, this, loading);
		this.steps[i] = step;
		this.stepsMarks += step.marks;
	}

	this.markingFeedback = [];

	this.scripts = {};
	var scriptNodes = xml.selectNodes('scripts/script');
	for(var i=0;i<scriptNodes.length; i++) {
		var name = scriptNodes[i].getAttribute('name');
		var script = Numbas.xml.getTextContent(scriptNodes[i]);
		var withEnv = {
			variables: this.question.unwrappedVariables,
			question: this.question,
			part: this
		};
		with(withEnv) {
			script = eval('(function(){try{'+script+'\n}catch(e){Numbas.showError(new Numbas.Error(\'part.script.error\',this.path,name,e.message))}})');
		}
		this.scripts[name] = script;
	}

	this.applyScripts();

	//initialise display code
	this.display = new Numbas.display.PartDisplay(this);

	if(loading)
	{
		var pobj = Numbas.store.loadPart(this);
		this.answered = pobj.answered;
		this.stepsShown = pobj.stepsShown;
		this.stepsOpen = pobj.stepsOpen;
	}
}

Part.prototype = /** @lends Numbas.parts.Part.prototype */ {
	/** XML defining this part
	 * @type {Element}
	 */
	xml: '',				
	
	/** The question this part belongs to
	 * @type {Numbas.Question}
	 */
	question: undefined,

	/** Reference to parent of this part, if this is a gap or a step
	 * @type {Numbas.parts.Part}
	 */
	parentPart: undefined,

	/** A question-wide unique 'address' for this part.
	 * @type {partpath}
	 */
	path: '',

	/** This part's type, e.g. "jme", "numberentry", ...
	 * @type {string}
	 */
	type: '',

	/** Maximum marks available for this part
	 * @type {number}
	 */
	marks: 0,

	/** Marks available for the steps, if any
	 * @type {number}
	 */
	stepsMarks: 0,

	/** Proportion of available marks awarded to the student - i.e. `score/marks`. Penalties will affect this instead of the raw score, because of things like the steps marking algorithm.
	 * @type {number}
	 */
	credit: 0,

	/** Student's score on this part
	 * @type {number}
	 */
	score: 0,
	
	/** Messages explaining how marks were awarded
	 * @type {feedbackmessage}
	 */
	markingFeedback: [],

	/** Has the student changed their answer since last submitting?
	 * @type {boolean}
	 */
	isDirty: false,

	/** Student's answers as visible on the screen (not necessarily yet submitted)
	 * @type {string[]}
	 */
	stagedAnswer: undefined,

	/** Student's last submitted answer - a copy of {@link Numbas.parts.Part.stagedAnswer} taken when they submitted.
	 * @type {string[]}
	 */
	answerList: undefined,

	/** Has this part been answered?
	 * @type {boolean}
	 */
	answered: false,

	/** Child gapfill parts
	 * @type {Numbas.parts.Part[]}
	 */
	gaps: [],

	/** Child step parts
	 * @type {Numbas.parts.Part[]}
	 */
	steps: [],

	/** Have the steps been show for this part?
	 * @type {boolean}
	 */
	stepsShown: false,

	/** Is the steps display open? (Students can toggle it, but that doesn't affect whether they get the penalty)
	 * @type {boolean}
	 */
	stepsOpen: false,

	/** Properties set when the part is generated
	 * @type {object}
	 * @property {number} stepsPenalty - Number of marks to deduct when the steps are shown
	 * @property {boolean} enableMinimumMarks - Is there a lower limit on the score the student can be awarded for this part?
	 * @property {number} minimumMarks - Lower limit on the score the student can be awarded for this part
	 * @property {boolean} showCorrectAnswer - Show the correct answer on reveal?
	 */
	settings: 
	{
		stepsPenalty: 0,
		enableMinimumMarks: false,
		minimumMarks: 0,
		showCorrectAnswer: true
	},

	applyScripts: function() {
		for(var name in this.scripts) {
			var script = this.scripts[name];
			switch(name) {
				case 'mark':
				case 'validate':
					this[name] = script;
					break;
				case 'constructor':
					this.customConstructor = script;
					break;
			}
		}
	},

	/** Associated display object
	 * @type {Numbas.display.PartDisplay}
	 */
	display: undefined,

	/** Give the student a warning about this part. 	
	 * @see {Numbas.display.PartDisplay.warning}
	 */
	giveWarning: function(warning)
	{
		this.display.warning(warning);
	},

	/** Calculate the student's score based on their submitted answers
	 *
	 * Calls the parent part's `calculateScore` method at the end.
	 */
	calculateScore: function()
	{
		if(this.steps.length && this.stepsShown)
		{
			var oScore = this.score = (this.marks - this.settings.stepsPenalty) * this.credit; 	//score for main keypart

			var stepsScore = 0, stepsMarks=0;
			for(var i=0; i<this.steps.length; i++)
			{
				stepsScore += this.steps[i].score;
				stepsMarks += this.steps[i].marks;
			}

			var stepsFraction = Math.max(Math.min(1-this.credit,1),0);	//any credit not earned in main part can be earned back in steps

			this.score += stepsScore;						//add score from steps to total score


			this.score = Math.min(this.score,this.marks - this.settings.stepsPenalty)	//if too many marks are awarded for steps, it's possible that getting all the steps right leads to a higher score than just getting the part right. Clip the score to avoid this.

			if(this.settings.enableMinimumMarks)								//make sure awarded score is not less than minimum allowed
				this.score = Math.max(this.score,this.settings.minimumMarks);

			if(stepsMarks!=0 && stepsScore!=0)
			{
				if(this.credit==1)
					this.markingComment(R('part.marking.steps no matter'));
				else
				{
					var change = this.score - oScore;
					this.markingComment(
						util.pluralise(change,
							R('part.marking.steps change single',math.niceNumber(change)),
							R('part.marking.steps change plural',math.niceNumber(change))
					));
				}
			}
		}
		else
		{
			this.score = this.credit * this.marks;
			//make sure awarded score is not less than minimum allowed
			if(this.settings.enableMinimumMarks && this.credit*this.marks<this.settings.minimumMarks)
				this.score = Math.max(this.score,this.settings.minimumMarks);
		}

		if(this.parentPart && !this.parentPart.submitting)
			this.parentPart.calculateScore();
	},

	/** Update the stored answer from the student (called when the student changes their answer, but before submitting) 
	 */
	storeAnswer: function(answerList) {
		this.stagedAnswer = answerList;
		this.setDirty(true);
		this.display.removeWarnings();
	},

	/** Call when the student changes their answer, or submits - update {@link Numbas.parts.Part.isDirty}
	 * @param {boolean} dirty
	 */
	setDirty: function(dirty) {
		this.isDirty = dirty;
		if(this.display) {
			this.display.isDirty(dirty);
			if(dirty && this.parentPart) {
				this.parentPart.setDirty(true);
			}
			this.question.display.isDirty(this.question.isDirty());
		}
	},


	/** Submit the student's answers to this part - remove warnings. save answer, calculate marks, update scores
	 */
	submit: function() {
		this.display.removeWarnings();
		this.credit = 0;
		this.markingFeedback = [];
		this.submitting = true;

		if(this.stepsShown)
		{
			var stepsMax = this.marks - this.settings.stepsPenalty;
			this.markingComment(
				this.settings.stepsPenalty>0 
					? util.pluralise(stepsMax,
						R('part.marking.revealed steps with penalty single',math.niceNumber(stepsMax)),
						R('part.marking.revealed steps with penalty plural',math.niceNumber(stepsMax))
						)
					: R('part.marking.revealed steps no penalty'));
		}

		if(this.stagedAnswer) {
			this.answerList = util.copyarray(this.stagedAnswer);
		}
		this.setStudentAnswer();

		if(this.marks==0) {
			this.answered = true;
			return;
		}
		if(this.stagedAnswer==undefined || this.stagedAnswer=='')
		{
			this.giveWarning(R('part.marking.not submitted'));
			this.setCredit(0,R('part.marking.did not answer'));;
			this.answered = false;
		}
		else
		{
			this.setDirty(false);
			this.mark();
			this.answered = this.validate();
		}

		if(this.stepsShown)
		{
			for(var i=0;i<this.steps.length;i++)
			{
				this.steps[i].submit();
			}
		}

		this.calculateScore();
		this.question.updateScore();

		if(this.answered)
		{
			if(!(this.parentPart && this.parentPart.type=='gapfill'))
				this.markingComment(
					util.pluralise(this.score,
						R('part.marking.total score single',math.niceNumber(this.score)),
						R('part.marking.total score plural',math.niceNumber(this.score))
					)
				);
		}

		Numbas.store.partAnswered(this);
		this.display.showScore(this.answered);

		this.submitting = false;
	},

	/** Save a copy of the student's answer as entered on the page, for use in marking.
	 * @abstract
	 */
	setStudentAnswer: function() {},

	/* Function which marks the student's answer
	 * @abstract
	 */
	mark: function() {},

	/** Set the `credit` to an absolute value
	 * @param {number} credit
	 * @param {string} message - message to show in feedback to explain this action
	 */
	setCredit: function(credit,message)
	{
		var oCredit = this.credit;
		this.credit = credit;
		this.markingFeedback.push({
			op: 'addCredit',
			credit: this.credit - oCredit,
			message: message
		});
	},

	/** Add an absolute value to `credit`
	 * @param {number} credit - amount to add
	 * @param {string} message - message to show in feedback to explain this action
	 */
	addCredit: function(credit,message)
	{
		this.credit += credit;
		this.markingFeedback.push({
			op: 'addCredit',
			credit: credit,
			message: message
		});
	},

	/** Multiply `credit` by the given amount - use to apply penalties
	 * @param {number} factor
	 * @param {string} message - message to show in feedback to explain this action
	 */
	multCredit: function(factor,message)
	{
		var oCredit = this.credit
		this.credit *= factor;
		this.markingFeedback.push({
			op: 'addCredit',
			credit: this.credit - oCredit,
			message: message
		});
	},

	/** Add a comment to the marking feedback
	 * @param {string} message
	 */
	markingComment: function(message)
	{
		this.markingFeedback.push({
			op: 'comment',
			message: message
		});
	},

	/** Is the student's answer acceptable?
	 * @abstract
	 * @returns {boolean}
	 */
	validate: function() { return true; },

	/** Show the steps
	 * @param {boolean} dontStore - don't tell the storage that this is happening - use when loading from storage to avoid callback loops
	 */
	showSteps: function(dontStore)
	{
		this.stepsShown = true;
		this.stepsOpen = true;
		this.calculateScore();
		this.display.showSteps();
		if(!this.revealed) {
			if(this.answered)
				this.submit();
			else
				this.question.updateScore();
		}
		if(!dontStore)
		{
			Numbas.store.stepsShown(this);
		}
	},

	/** Close the steps box. This doesn't affect the steps penalty.
	 */
	hideSteps: function()
	{
		this.stepsOpen = false;
		this.display.hideSteps();
		Numbas.store.stepsHidden(this);
	},

	/** Reveal the correct answer to this part
	 * @param {boolean} dontStore - don't tell the storage that this is happening - use when loading from storage to avoid callback loops
	 */
	revealAnswer: function(dontStore)
	{
		this.display.revealAnswer();
		this.revealed = true;

		//this.setCredit(0);
		if(this.steps.length>0) {
			this.showSteps(dontStore);
			for(var i=0; i<this.steps.length; i++ )
			{
				this.steps[i].revealAnswer(dontStore);
			}
		}
	}

};

/** Judged Mathematical Expression
 *
 * Student enters a string representing a mathematical expression, eg. `x^2+x+1`, and it is compared with the correct answer by evaluating over a range of values.
 * @constructor
 * @memberof Numbas.parts
 * @augments Numbas.parts.Part
 */
function JMEPart(xml, path, question, parentPart, loading)
{
	var settings = this.settings;
	util.copyinto(JMEPart.prototype.settings,settings);

	//parse correct answer from XML
	answerMathML = this.xml.selectSingleNode('answer/correctanswer');
	if(!answerMathML)
		throw(new Numbas.Error('part.jme.answer missing',this.path));

	tryGetAttribute(settings,this.xml,'answer/correctanswer','simplification','answerSimplification');

	settings.answerSimplification = Numbas.jme.collectRuleset(settings.answerSimplification,this.question.scope.rulesets);

	settings.correctAnswer = jme.display.simplifyExpression(
		Numbas.xml.getTextContent(answerMathML).trim(),
		settings.answerSimplification,
		this.question.scope
	);
	if(settings.correctAnswer == '' && this.marks>0) {
		throw(new Numbas.Error('part.jme.answer missing',this.path));
	}

	this.markingScope = new jme.Scope(this.question.scope);
	this.markingScope.variables = {};

	settings.displaySimplification = '';
	
	//get checking type, accuracy, checking range
	var parametersPath = 'answer';
	tryGetAttribute(settings,this.xml,parametersPath+'/checking',['type','accuracy','failurerate'],['checkingType','checkingAccuracy','failureRate']);

	tryGetAttribute(settings,this.xml,parametersPath+'/checking/range',['start','end','points'],['vsetRangeStart','vsetRangeEnd','vsetRangePoints']);


	//max length and min length
	tryGetAttribute(settings,this.xml,parametersPath+'/maxlength',['length','partialcredit'],['maxLength','maxLengthPC']);
	var messageNode = xml.selectSingleNode('answer/maxlength/message');
	if(messageNode)
	{
		settings.maxLengthMessage = $.xsl.transform(Numbas.xml.templates.question,messageNode).string;
		if($(settings.maxLengthMessage).text() == '')
			settings.maxLengthMessage = R('part.jme.answer too long');
	}
	tryGetAttribute(settings,this.xml,parametersPath+'/minlength',['length','partialcredit'],['minLength','minLengthPC']);
	var messageNode = xml.selectSingleNode('answer/minlength/message');
	if(messageNode)
	{
		settings.minLengthMessage = $.xsl.transform(Numbas.xml.templates.question,messageNode).string;
		if($(settings.minLengthMessage).text() == '')
			settings.minLengthMessage = R('part.jme.answer too short');
	}

	//get list of 'must have' strings
	var mustHaveNode = this.xml.selectSingleNode('answer/musthave');
	settings.mustHave = [];
	if(mustHaveNode)
	{
		var mustHaves = mustHaveNode.selectNodes('string');
		for(var i=0; i<mustHaves.length; i++)
		{
			settings.mustHave.push(Numbas.xml.getTextContent(mustHaves[i]));
		}
		//partial credit for failing must-have test and whether to show strings which must be present to student when warning message displayed
		tryGetAttribute(settings,this.xml,mustHaveNode,['partialcredit','showstrings'],['mustHavePC','mustHaveShowStrings']);
		//warning message to display when a must-have is missing
		var messageNode = mustHaveNode.selectSingleNode('message');
		if(messageNode)
			settings.mustHaveMessage = $.xsl.transform(Numbas.xml.templates.question,messageNode).string;
	}

	//get list of 'not allowed' strings
	var notAllowedNode = this.xml.selectSingleNode('answer/notallowed');
	settings.notAllowed = [];
	if(notAllowedNode)
	{
		var notAlloweds = notAllowedNode.selectNodes('string');
		for(i=0; i<notAlloweds.length; i++)
		{
			settings.notAllowed.push(Numbas.xml.getTextContent(notAlloweds[i]));
		}
		//partial credit for failing not-allowed test
		tryGetAttribute(settings,this.xml,notAllowedNode,['partialcredit','showstrings'],['notAllowedPC','notAllowedShowStrings']);
		var messageNode = notAllowedNode.selectSingleNode('message');
		if(messageNode)
			settings.notAllowedMessage = $.xsl.transform(Numbas.xml.templates.question,messageNode).string;
	}

	tryGetAttribute(settings,this.xml,parametersPath,['checkVariableNames','showPreview']);
	var expectedVariableNamesNode = this.xml.selectSingleNode('answer/expectedvariablenames');
	settings.expectedVariableNames = [];
	if(expectedVariableNamesNode)
	{
		var nameNodes = expectedVariableNamesNode.selectNodes('string');
		for(i=0; i<nameNodes.length; i++)
			settings.expectedVariableNames.push(Numbas.xml.getTextContent(nameNodes[i]).toLowerCase());
	}

	this.display = new Numbas.display.JMEPartDisplay(this);

	if(loading)	{
		var pobj = Numbas.store.loadJMEPart(this);
		this.stagedAnswer = [pobj.studentAnswer];
	}
	else {
		this.stagedAnswer = [''];
	}
}

JMEPart.prototype = /** @lends Numbas.JMEPart.prototype */ 
{
	/** Student's last submitted answer
	 * @type {string}
	 */
	studentAnswer: '',

	/** Properties set when the part is generated.
	 *
	 * Extends {@link Numbas.parts.Part#settings}
	 * @property {string} correctAnswer - An expression representing the correct answer to the question. The student's answer should evaluate to the same value as this.
	 * @property {string[]} names of simplification rules (see {@link Numbas.jme.display.Rule}) to use on the correct answer
	 * @property {string} checkingType - method to compare answers. See {@link Numbas.jme.checkingFunctions}
	 * @property {number} checkingAccuracy - accuracy threshold for checking. Exact definition depends on the checking type.
	 * @property {number} failureRate - comparison failures allowed before we decide answers are different
	 * @property {number} vsetRangeStart - lower bound on range of points to pick values from for variables in the answer expression
	 * @property {number} vsetRangeEnd - upper bound on range of points to pick values from for variables in the answer expression
	 * @property {number} vsetRangePoints - number of points to compare answers on
	 * @property {number} maxLength - maximum length, in characters, of the student's answer. Note that the student's answer is cleaned up before checking length, so extra space or brackets aren't counted
	 * @property {number} maxLengthPC - partial credit if the student's answer is too long
	 * @property {string} maxLengthMessage - Message to add to marking feedback if the student's answer is too long
	 * @property {number} minLength - minimum length, in characters, of the student's answer. Note that the student's answer is cleaned up before checking length, so extra space or brackets aren't counted
	 * @property {number} minLengthPC - partial credit if the student's answer is too short
	 * @property {string} minLengthMessage - message to add to the marking feedback if the student's answer is too short
	 * @property {string[]} mustHave - strings which must be present in the student's answer
	 * @property {number} mustHavePC - partial credit to award if any must-have string is missing
	 * @property {string} mustHaveMessage - message to add to the marking feedback if the student's answer is missing a must-have string.
	 * @property {boolean} mustHaveShowStrings - tell the students which strings must be included in the marking feedback, if they're missing a must-have?
	 * @property {string[]} notAllowed - strings which must not be present in the student's answer
	 * @property {number} notAllowedPC - partial credit to award if any not-allowed string is present
	 * @property {string} notAllowedMessage - message to add to the marking feedback if the student's answer contains a not-allowed string.
	 * @property {boolean} notAllowedShowStrings - tell the students which strings must not be included in the marking feedback, if they've used a not-allowed string?
	 */
	settings: 
	{
		correctAnswer: '',

		answerSimplification: ['basic','unitFactor','unitPower','unitDenominator','zeroFactor','zeroTerm','zeroPower','collectNumbers','zeroBase','constantsFirst','sqrtProduct','sqrtDivision','sqrtSquare','otherNumbers'],
		
		checkingType: 'RelDiff',

		checkingAccuracy: 0,
		failureRate: 0,

		vsetRangeStart: 0,
		vsetRangeEnd: 1,
		vsetRangePoints: 1,
		
		maxLength: 0,
		maxLengthPC: 0,
		maxLengthMessage: 'Your answer is too long',

		minLength: 0,
		minLengthPC: 0,
		minLengthMessage: 'Your answer is too short',

		mustHave: [],
		mustHavePC: 0,
		mustHaveMessage: '',
		mustHaveShowStrings: false,

		notAllowed: [],
		notAllowedPC: 0,
		notAllowedMessage: '',
		notAllowedShowStrings: false
	},

	/** Save a copy of the student's answer as entered on the page, for use in marking.
	 */
	setStudentAnswer: function() {
		this.studentAnswer = this.answerList[0];
	},

	/** Mark the student's answer
	 */
	mark: function()
	{
		if(this.answerList==undefined)
		{
			this.setCredit(0,R('part.marking.nothing entered'));
			return false;
		}

		try
		{
			var simplifiedAnswer = Numbas.jme.display.simplifyExpression(this.studentAnswer,'',this.question.scope);
		}
		catch(e)
		{
			this.setCredit(0,R('part.jme.answer invalid',e.message));
			return;
		}

		if(this.settings.checkVariableNames) {
			var tree = jme.compile(this.studentAnswer,this.question.scope);
			var usedvars = jme.findvars(tree);
			this.failExpectedVariableNames = false;
			for(var i=0;i<usedvars.length;i++) {
				if(!this.settings.expectedVariableNames.contains(usedvars[i].toLowerCase())) {
					this.failExpectedVariableNames = true;
					this.unexpectedVariableName = usedvars[i];
					break;
				}
			}
		}

		this.failMinLength = (this.settings.minLength>0 && simplifiedAnswer.length<this.settings.minLength);
		this.failMaxLength = (this.settings.maxLength>0 && simplifiedAnswer.length>this.settings.maxLength);
		this.failNotAllowed = false;
		this.failMustHave = false;

		//did student actually write anything?
		this.answered = this.studentAnswer.length > 0;
		
		//do comparison of student's answer with correct answer
		if(!jme.compare(this.studentAnswer, this.settings.correctAnswer, this.settings, this.markingScope))
		{
			this.setCredit(0,R('part.marking.incorrect'));
			return;
		}

		var noSpaceAnswer = this.studentAnswer.replace(/\s/g,'');
		//see if student answer contains any forbidden strings
		for( i=0; i<this.settings.notAllowed.length; i++ )
		{
			if(noSpaceAnswer.contains(this.settings.notAllowed[i])) { this.failNotAllowed = true; }
		}

		if(!this.failNotAllowed)
		{
			//see if student answer contains all the required strings
			for( i=0; i<this.settings.mustHave.length; i++ )
			{
				if(!noSpaceAnswer.contains(this.settings.mustHave[i])) { this.failMustHave = true; }
			}
		}

		//calculate how many marks will be given for a correct answer
		//(can be modified if answer wrong length or fails string restrictions)
		this.setCredit(1,R('part.jme.marking.correct'));

		if(this.failMinLength)
		{
			this.multCredit(this.settings.minLengthPC,this.settings.minLengthMessage);
		}
		if(this.failMaxLength)
		{
			this.multCredit(this.settings.maxLengthPC,this.settings.maxLengthMessage);
		}

		if(this.failMustHave)
		{
			if(this.settings.mustHaveShowStrings)
			{
				var strings = this.settings.mustHave.map(function(x){return R('part.jme.must-have bits',x)});
				var message = this.settings.mustHave.length==1 ? R('part.jme.must-have one',strings) : R('jme.must-have several',strings)
				this.addCredit(0,message);
			}
			this.multCredit(this.settings.mustHavePC,this.settings.mustHaveMessage);
		}

		if(this.failNotAllowed)
		{
			if(this.settings.notAllowedShowStrings)
			{
				var strings = this.settings.notAllowed.map(function(x){return R('part.jme.not-allowed bits',x)});
				var message = this.settings.notAllowed.length==1 ? R('part.jme.not-allowed one',strings) : R('jme.not-allowed several',strings)
				this.addCredit(0,message);
			}
			this.multCredit(this.settings.notAllowedPC,this.settings.notAllowedMessage);
		}

	},

	/** Is the student's answer valid? False if student hasn't submitted an answer
	 * @returns {boolean}
	 */
	validate: function()
	{
		if(this.studentAnswer.length===0)
		{
			this.giveWarning(R('part.marking.not submitted'));
			return false;
		}

		try{
			var scope = new jme.Scope(this.question.scope);

			var tree = jme.compile(this.studentAnswer,scope);
			var varnames = jme.findvars(tree);
			for(i=0;i<varnames.length;i++)
			{
				scope.variables[varnames[i]]=new jme.types.TNum(0);
			}
			jme.evaluate(tree,scope);
		}
		catch(e)
		{
			this.giveWarning(R('part.jme.answer invalid',e.message));
			return false;
		}

		if( this.failExpectedVariableNames ) {
			var suggestedNames = this.unexpectedVariableName.split(jme.re.re_short_name);
			if(suggestedNames.length>3) {
				var suggestion = [];
				for(var i=1;i<suggestedNames.length;i+=2) {
					suggestion.push(suggestedNames[i]);
				}
				suggestion = suggestion.join('*');
				this.giveWarning(R('part.jme.unexpected variable name suggestion',this.unexpectedVariableName,suggestion));
			}
			else
				this.giveWarning(R('part.jme.unexpected variable name', this.unexpectedVariableName));
		}

		if( this.failMinLength)
		{
			this.giveWarning(this.settings.minLengthMessage);
		}

		if( this.failMaxLength )
		{
			this.giveWarning(this.settings.maxLengthMessage);
		}

		if( this.failMustHave )
		{
			this.giveWarning(this.settings.mustHaveMessage);
			if(this.settings.mustHaveShowStrings)
			{
				var strings = this.settings.mustHave.map(function(x){return R('part.jme.must-have bits',x)});
				var message = this.settings.mustHave.length==1 ? R('part.jme.must-have one',strings) : R('jme.must-have several',strings)
				this.giveWarning(message);
			}
		}

		if( this.failNotAllowed )
		{
			this.giveWarning(this.settings.notAllowedMessage);
			if(this.settings.notAllowedShowStrings)
			{
				var strings = this.settings.notAllowed.map(function(x){return R('part.jme.not-allowed bits',x)});
				var message = this.settings.notAllowed.length==1 ? R('part.jme.not-allowed one',strings) : R('jme.not-allowed several',strings)
				this.giveWarning(message);
			}
		}

		return true;
	}
};

/** Text-entry part - student's answer must match the given regular expression
 * @constructor
 * @memberof Numbas.parts
 * @augments Numbas.parts.Part
 */
function PatternMatchPart(xml, path, question, parentPart, loading)
{
	var settings = this.settings;
	util.copyinto(PatternMatchPart.prototype.settings,settings);

	settings.correctAnswer = Numbas.xml.getTextContent(this.xml.selectSingleNode('correctanswer'));
	settings.correctAnswer = '^'+jme.contentsubvars(settings.correctAnswer, question.scope)+'$';

	var displayAnswerNode = this.xml.selectSingleNode('displayanswer');
	if(!displayAnswerNode)
		throw(new Numbas.Error('part.patternmatch.display answer missing',this.path));
	settings.displayAnswer = $.trim(Numbas.xml.getTextContent(displayAnswerNode));
	settings.displayAnswer = jme.contentsubvars(settings.displayAnswer,question.scope);

	tryGetAttribute(settings,this.xml,'case',['sensitive','partialCredit'],'caseSensitive');

	this.display = new Numbas.display.PatternMatchPartDisplay(this);

	if(loading)
	{
		var pobj = Numbas.store.loadPatternMatchPart(this);
		this.stagedAnswer = [pobj.studentAnswer];
	}
}
PatternMatchPart.prototype = /** @lends Numbas.PatternMatchPart.prototype */ {
	/** The student's last submitted answer 
	 * @type {string}
	 */
	studentAnswer: '',

	/** Properties set when the part is generated.
	 * Extends {@link Numbas.parts.Part#settings}
	 * @property {RegExp} correctAnswer - regular expression pattern to match correct answers
	 * @property {string} displayAnswer - a representative correct answer to display when answers are revealed
	 * @property {boolean} caseSensitive - does case matter?
	 * @property {number} partialCredit - partial credit to award if the student's answer matches, apart from case, and `caseSensitive` is `true`.
	 */
	settings: 
	{
		correctAnswer: /.*/,
		displayAnswer: '',
		caseSensitive: false,
		partialCredit: 0
	},

	/** Save a copy of the student's answer as entered on the page, for use in marking.
	 */
	setStudentAnswer: function() {
		this.studentAnswer = this.answerList[0];
	},

	/** Mark the student's answer
	 */
	mark: function ()
	{
		if(this.answerList==undefined)
		{
			this.setCredit(0,R('part.marking.nothing entered'));
			return false;
		}
		this.answered = this.studentAnswer.length>0;

		var caseInsensitiveAnswer = new RegExp( this.settings.correctAnswer, 'i' );			
		var caseSensitiveAnswer = new RegExp( this.settings.correctAnswer );
		
		if( this.settings.caseSensitive )
		{
			if( caseSensitiveAnswer.test(this.studentAnswer) )
			{
				this.setCredit(1,R('part.marking.correct'));
			}
			else if(caseInsensitiveAnswer.test(this.studentAnswer))
			{
				this.setCredit(this.settings.partialCredit,R('part.patternmatch.correct except case'));
			}
			else
			{
				this.setCredit(0,R('part.marking.incorrect'));
			}
		}else{
			if(caseInsensitiveAnswer.test(this.studentAnswer))
			{
				this.setCredit(1,R('part.marking.correct'));
			}
			else
			{
				this.setCredit(0,R('part.marking.incorrect'));
			}
		}
	},

	/** Is the student's answer valid? False if the part hasn't been submitted.
	 * @returns {boolean}
	 */
	validate: function()
	{
		if(!this.answered)
			this.giveWarning(R('part.marking.not submitted'));

		return this.answered;
	}
};

/** Number entry part - student's answer must be within given range, and written to required precision.
 * @constructor
 * @memberof Numbas.parts
 * @augments Numbas.parts.Part
 */
function NumberEntryPart(xml, path, question, parentPart, loading)
{
	var evaluate = jme.evaluate, compile = jme.compile;
	var settings = this.settings;
	util.copyinto(NumberEntryPart.prototype.settings,settings);

	tryGetAttribute(settings,this.xml,'answer',['minvalue','maxvalue'],['minvalue','maxvalue'],{string:true});
	tryGetAttribute(settings,this.xml,'answer',['correctanswerfraction','inputstep','allowfractions'],['correctAnswerFraction','inputStep','allowFractions']);

	tryGetAttribute(settings,this.xml,'answer/allowonlyintegeranswers',['value','partialcredit'],['integerAnswer','integerPC']);
	tryGetAttribute(settings,this.xml,'answer/precision',['type','partialcredit','strict'],['precisionType','precisionPC','strictPrecision']);
	tryGetAttribute(settings,this.xml,'answer/precision','precision','precision',{'string':true});
	settings.precision = jme.subvars(settings.precision, this.question.scope);
	settings.precision = evaluate(settings.precision,this.question.scope).value;

	if(settings.precisionType!='none') {
		settings.allowFractions = false;
	}

	var minvalue = jme.subvars(settings.minvalue,this.question.scope);
	minvalue = evaluate(minvalue,this.question.scope);
	if(minvalue && minvalue.type=='number')
		minvalue = minvalue.value;
	else
		throw(new Numbas.Error('part.setting not present','minimum value',this.path,this.question.name));

	var maxvalue = jme.subvars(settings.maxvalue,this.question.scope);
	maxvalue = evaluate(maxvalue,this.question.scope);
	if(maxvalue && maxvalue.type=='number')
		maxvalue = maxvalue.value;
	else
		throw(new Numbas.Error('part.setting not present','maximum value',this.path,this.question.name));

	var fudge = 0.00000000001;
	switch(settings.precisionType) {
	case 'dp':
		minvalue = math.precround(minvalue,settings.precision);
		maxvalue = math.precround(maxvalue,settings.precision);
		break;
	case 'sigfig':
		minvalue = math.siground(minvalue,settings.precision);
		maxvalue = math.siground(maxvalue,settings.precision);
		break;
	}

	settings.minvalue = minvalue - fudge;
	settings.maxvalue = maxvalue + fudge;

	var messageNode = this.xml.selectSingleNode('answer/precision/message');
	if(messageNode)
		settings.precisionMessage = $.xsl.transform(Numbas.xml.templates.question,messageNode).string;

	var displayAnswer = (settings.minvalue + settings.maxvalue)/2;
	if(settings.correctAnswerFraction) {
		settings.displayAnswer = jme.display.jmeRationalNumber(displayAnswer);
	} else {
		settings.displayAnswer = math.niceNumber(displayAnswer,{precisionType: settings.precisionType,precision:settings.precision});
	}

	this.display = new Numbas.display.NumberEntryPartDisplay(this);
	
	if(loading)
	{
		var pobj = Numbas.store.loadNumberEntryPart(this);
		this.stagedAnswer = [pobj.studentAnswer+''];
	}
}
NumberEntryPart.prototype = /** @lends Numbas.parts.NumberEntryPart.prototype */
{
	/** The student's last submitted answer */
	studentAnswer: '',

	/** Properties set when the part is generated
	 * Extends {@link Numbas.parts.Part#settings}
	 * @property {number} inputStep - step size for the number input if it's being displayed as an `<input type=number>` control.
	 * @property {number} minvalue - minimum value marked correct
	 * @property {number} maxvalue - maximum value marked correct
	 * @property {number} correctAnswerFraction - display the correct answer as a fraction?
	 * @property {boolean} integerAnswer - must the answer be an integer?
	 * @property {boolean} allowFractions - can the student enter a fraction as their answer?
	 * @property {number} integerPC - partial credit to award if the answer is between `minvalue` and `maxvalue` but not an integer, when `integerAnswer` is true.
	 * @property {number} displayAnswer - representative correct answer to display when revealing answers
	 * @property {string} precisionType - type of precision restriction to apply: `none`, `dp` - decimal places, or `sigfig` - significant figures
	 * @property {number} precision - how many decimal places or significant figures to require
	 * @property {number} precisionPC - partial credit to award if the answer is between `minvalue` and `maxvalue` but not given to the required precision
	 * @property {string} precisionMessage - message to display in the marking feedback if their answer was not given to the required precision
	 */
	settings:
	{
		inputStep: 1,
		minvalue: 0,
		maxvalue: 0,
		correctAnswerFraction: false,
		integerAnswer: false,
		allowFractions: false,
		integerPC: 0,
		displayAnswer: 0,
		precisionType: 'none',
		precision: 0,
		precisionPC: 0,
		precisionMessage: R('You have not given your answer to the correct precision.')
	},

	/** Tidy up the student's answer - remove space, and get rid of comma separators
	 * @param {string} answer}
	 * @returns {string}
	 */
	cleanAnswer: function(answer) {
		// do a bit of string tidy up
		// uk number format only for now - get rid of any UK 1000 separators	
		answer = (answer+'').replace(/,/g, '');
		answer = $.trim(answer);
		return answer;
	},

	/** Save a copy of the student's answer as entered on the page, for use in marking.
	 */
	setStudentAnswer: function() {
		this.studentAnswer = this.cleanAnswer(this.answerList[0]);
	},

	/** Mark the student's answer */
	mark: function()
	{
		if(this.answerList==undefined)
		{
			this.setCredit(0,R('part.marking.nothing entered'));
			return false;
		}
		
		if( this.studentAnswer.length>0 && util.isNumber(this.studentAnswer,this.settings.allowFractions) )
		{
			var answerFloat = util.parseNumber(this.studentAnswer,this.settings.allowFractions);
			if( answerFloat <= this.settings.maxvalue && answerFloat >= this.settings.minvalue )
			{
				if(this.settings.integerAnswer && math.countDP(this.studentAnswer)>0)
					this.setCredit(this.settings.integerPC,R('part.numberentry.correct except decimal'));
				else
					this.setCredit(1,R('part.marking.correct'));
			}else{
				this.setCredit(0,R('part.marking.incorrect'));
			}
			this.answered = true;

			var failedPrecision = !math.toGivenPrecision(this.studentAnswer,this.settings.precisionType,this.settings.precision,this.settings.strictPrecision);
			
			if(failedPrecision) {
				this.multCredit(this.settings.precisionPC,this.settings.precisionMessage);
			}
		}else{
			this.answered = false;
			this.setCredit(0,R('part.numberentry.answer invalid'));
		}
	},

	/** Is the student's answer valid? False if the part hasn't been submitted.
	 * @returns {boolean}
	 */
	validate: function()
	{
		if(!this.answered)
			this.giveWarning(R('part.marking.not submitted'));
		
		return this.answered;
	}
};

/** Matrix entry part - student enters a matrix of numbers
 * @constructor
 * @memberof Numbas.parts
 * @augments Numbas.parts.Part
 */
function MatrixEntryPart(xml, path, question, parentPart, loading) {
	var evaluate = jme.evaluate, compile = jme.compile;
	var settings = this.settings;
	util.copyinto(MatrixEntryPart.prototype.settings,settings);

	tryGetAttribute(settings,this.xml,'answer',['correctanswer'],['correctAnswer'],{string:true});
	tryGetAttribute(settings,this.xml,'answer',['correctanswerfractions','rows','columns','allowresize','tolerance','markpercell','allowfractions'],['correctAnswerFractions','numRows','numColumns','allowResize','tolerance','markPerCell','allowFractions']);
	settings.tolerance = Math.max(settings.tolerance,0.00000000001);

	var correctAnswer = jme.subvars(settings.correctAnswer,this.question.scope);
	correctAnswer = evaluate(correctAnswer,this.question.scope);
	if(correctAnswer && correctAnswer.type=='matrix') {
		settings.correctAnswer = correctAnswer.value;
	} else if(correctAnswer && correctAnswer.type=='vector') {
		settings.correctAnswer = Numbas.vectormath.toMatrix(correctAnswer.value);
	} else {
		throw(new Numbas.Error('part.setting not present','correct answer',this.path,this.question.name));
	}

	tryGetAttribute(settings,this.xml,'answer/precision',['type','partialcredit','strict'],['precisionType','precisionPC','strictPrecision']);
	tryGetAttribute(settings,this.xml,'answer/precision','precision','precision',{'string':true});
	settings.precision = jme.subvars(settings.precision, this.question.scope);
	settings.precision = evaluate(settings.precision,this.question.scope).value;

	if(settings.precisionType!='none') {
		settings.allowFractions = false;
	}

	switch(settings.precisionType) {
	case 'dp':
		settings.correctAnswer = Numbas.matrixmath.precround(settings.correctAnswer,settings.precision);
		break;
	case 'sigfig':
		settings.correctAnswer = Numbas.matrixmath.precround(settings.correctAnswer,settings.precision);
		break;
	}

	this.studentAnswer = [];
	for(var i=0;i<this.settings.numRows;i++) {
		var row = [];
		for(var j=0;j<this.settings.numColumns;j++) {
			row.push('');
		}
		this.studentAnswer.push(row);
	}
	
	var messageNode = this.xml.selectSingleNode('answer/precision/message');
	if(messageNode) {
		settings.precisionMessage = $.xsl.transform(Numbas.xml.templates.question,messageNode).string;
	}

	this.display = new Numbas.display.MatrixEntryPartDisplay(this);

	if(loading)
	{
		var pobj = Numbas.store.loadMatrixEntryPart(this);
		if(pobj.studentAnswer) {
			var rows = pobj.studentAnswer.length;
			var columns = rows>0 ? pobj.studentAnswer[0].length : 0;
			this.stagedAnswer = [rows, columns, pobj.studentAnswer];
		}
	}
}
MatrixEntryPart.prototype = /** @lends Numbas.parts.MatrixEntryPart.prototype */
{
	/** The student's last submitted answer */
	studentAnswer: '',

	/** Properties set when part is generated
	 * Extends {@link Numbas.parts.Part#settings}
	 * @property {matrix} correctAnswer - the correct answer to the part
	 * @property {number} numRows - default number of rows in the student's answer
	 * @property {number} numColumns - default number of columns in the student's answer
	 * @property {boolean} allowResize - allow the student to change the dimensions of their answer?
	 * @property {number} tolerance - allowed margin of error in each cell (if student's answer is within +/- `tolerance` of the correct answer (after rounding to , mark it as correct
	 * @property {boolean} markPerCell - should the student gain marks for each correct cell (true), or only if they get every cell right (false)?
	 * @property {boolean} allowFractions - can the student enter a fraction as their answer for a cell?
	 * @property {string} precisionType - type of precision restriction to apply: `none`, `dp` - decimal places, or `sigfig` - significant figures
	 * @property {number} precision - how many decimal places or significant figures to require
	 * @property {number} precisionPC - partial credit to award if the answer is between `minvalue` and `maxvalue` but not given to the required precision
	 * @property {string} precisionMessage - message to display in the marking feedback if their answer was not given to the required precision
	 */
	settings: {
		correctAnswer: null,
		correctAnswerFractions: false,
		numRows: 3,
		numColumns: 3,
		allowResize: true,
		tolerance: 0,
		markPerCell: false,
		allowFractions: false,
		precisionType: 'none',	//'none', 'dp' or 'sigfig'
		precision: 0,
		precisionPC: 0,	//fraction of credit to take away if precision wrong
		precisionMessage: R('You have not given your answer to the correct precision.')	//message to give to student if precision wrong
	},

	/** Save a copy of the student's answer as entered on the page, for use in marking.
	 */
	setStudentAnswer: function() {
		this.studentAnswerRows = parseInt(this.stagedAnswer[0]);
		this.studentAnswerColumns = parseInt(this.stagedAnswer[1]);
		this.studentAnswer = this.stagedAnswer[2];
	},

	/** Mark the student's answer */
	mark: function()
	{
		if(this.answerList===undefined)
		{
			this.setCredit(0,R('part.marking.nothing entered'));
			return false;
		}

		var correctMatrix = this.settings.correctAnswer;

		if(this.studentAnswer) {
			var precisionOK = true;
			var rows = this.studentAnswerRows;
			var columns = this.studentAnswerColumns;

			var studentMatrix = [];
			this.invalidCell = false;
			for(var i=0;i<rows;i++) {
				var row = [];
				for(var j=0;j<columns;j++) {
					var cell = this.studentAnswer[i][j];
					var n = util.parseNumber(cell,this.settings.allowFractions);
					
					if(isNaN(n)) {
						this.setCredit(0,R('part.matrix.invalid cell'));
						this.invalidCell = true;
						return;
					} else {
						row.push(n);
						precisionOK &= math.toGivenPrecision(cell,this.settings.precisionType,this.settings.precision,this.settings.strictPrecision); 
					}
				}
				studentMatrix.push(row);
			}

			studentMatrix.rows = rows;
			studentMatrix.columns = columns;

			this.wrongSize = rows!=correctMatrix.rows || columns!=correctMatrix.columns;
			if(this.wrongSize) {
				this.answered = true;
				this.setCredit(0,R('part.marking.incorrect'));
				return;
			}

			var rounders = {'dp': Numbas.matrixmath.precround, 'sigfig': Numbas.matrixmath.siground, 'none': function(x){return x}};
			var round = rounders[this.settings.precisionType];
			studentMatrix = round(studentMatrix,this.settings.precision);

			var numIncorrect = 0;
			for(var i=0;i<rows;i++) {
				for(var j=0;j<columns;j++) {
					var studentCell = studentMatrix[i][j];
					var correctCell = correctMatrix[i][j];
					if(!math.withinTolerance(studentCell,correctCell,this.settings.tolerance)) {
						numIncorrect += 1;
					}
				}
			}

			var numCells = rows*columns;

			if(numIncorrect==0) {
				this.setCredit(1,R('part.marking.correct'));
			} else if(this.settings.markPerCell && numIncorrect<numCells) {
				this.setCredit( (numCells-numIncorrect)/numCells, R('part.matrix.some incorrect',numIncorrect) );
			} else {
				this.setCredit(0,R('part.marking.incorrect'));
			}

			if(!precisionOK) {
				this.multCredit(this.settings.precisionPC,this.settings.precisionMessage);
			}

			this.answered = true;
		} else {
			this.answered = false;
			this.setCredit(0,R('part.matrix.answer invalid'));
		}
	},

	/** Is the student's answer valid? False if the part hasn't been submitted.
	 * @returns {boolean}
	 */
	validate: function()
	{
		if(this.invalidCell) {
			this.giveWarning(R('part.matrix.invalid cell'));
		} else if(!this.answered) {
			this.giveWarning(R('part.matrix.empty cell'));
		}
		
		return this.answered;
	}
}


/** Multiple choice part - either pick one from a list, pick several from a list, or match choices with answers (2d grid, either pick one from each row or tick several from each row)
 *
 * Types:
 * * `1_n_2`: pick one from a list. Represented as N answers, 1 choice
 * * `m_n_2`: pick several from a list. Represented as N answers, 1 choice
 * * `m_n_x`: match choices (rows) with answers (columns). Represented as N answers, X choices.
 *
 * @constructor
 * @augments Numbas.parts.Part
 * @memberof Numbas.parts
 */
function MultipleResponsePart(xml, path, question, parentPart, loading)
{
	var settings = this.settings;
	util.copyinto(MultipleResponsePart.prototype.settings,settings);


	//work out marks available
	tryGetAttribute(settings,this.xml,'marking/maxmarks','enabled','maxMarksEnabled');
	if(settings.maxMarksEnabled)
	{
		tryGetAttribute(this,this.xml,'marking/maxmarks','value','marks');
	}
	else
	{
		tryGetAttribute(this,this.xml,'.','marks');
	}

	//get minimum marks setting
	tryGetAttribute(settings,this.xml,'marking/minmarks','enabled','minMarksEnabled');
	if(settings.minMarksEnabled)
	{
		tryGetAttribute(this.settings,this.xml,'marking/minmarks','value','minimumMarks');
	}

	//get restrictions on number of choices
	var choicesNode = this.xml.selectSingleNode('choices');
	if(!choicesNode)
		throw(new Numbas.Error('part.mcq.choices missing',this.path));

	tryGetAttribute(settings,null,choicesNode,['minimumexpected','maximumexpected','order','displayType'],['minAnswers','maxAnswers','choiceOrder']);

	var minAnswers = jme.subvars(settings.minAnswers, question.scope);
	minAnswers = jme.evaluate(settings.minAnswers,this.question.scope);
	if(minAnswers && minAnswers.type=='number')
		settings.minAnswers = minAnswers.value;
	else
		throw(new Numbas.Error('part.setting not present','minimum answers',this.path,this.question.name))
	var maxAnswers = jme.subvars(settings.maxAnswers, question.scope);
	maxAnswers = jme.evaluate(settings.maxAnswers,this.question.scope);
	if(maxAnswers && maxAnswers.type=='number')
		settings.maxAnswers = maxAnswers.value;
	else
		throw(new Numbas.Error('part.setting not present','maximum answers',this.path,this.question.name))

	var choiceNodes = choicesNode.selectNodes('choice');
	this.numChoices = choiceNodes.length;
	
	//get number of answers and answer order setting
	if(this.type == '1_n_2' || this.type == 'm_n_2')
	{
		this.numAnswers = 1;
	}
	else
	{
		var answersNode = this.xml.selectSingleNode('answers');
		if(answersNode)
		{
			tryGetAttribute(settings,null,answersNode,'order','answerOrder');
			var answerNodes = answersNode.selectNodes('answer');
			this.numAnswers = answerNodes.length;
		}
	}

	//get warning type and message for wrong number of choices
	warningNode = this.xml.selectSingleNode('marking/warning');
	if(warningNode)
	{
		tryGetAttribute(settings,null,warningNode,'type','warningType');
	}
	
	if(loading)
	{
		var pobj = Numbas.store.loadMultipleResponsePart(this);
		this.shuffleChoices = pobj.shuffleChoices;
		this.shuffleAnswers = pobj.shuffleAnswers;
		this.ticks = pobj.ticks;
	}
	else
	{
		this.shuffleChoices=[];
		if(settings.choiceOrder=='random')
		{
			this.shuffleChoices = math.deal(this.numChoices);
		}
		else
		{
			this.shuffleChoices = math.range(this.numChoices);
		}

		this.shuffleAnswers=[];
		if(settings.answerOrder=='random')
		{
			this.shuffleAnswers = math.deal(this.numAnswers);
		}
		else
		{
			this.shuffleAnswers = math.range(this.numAnswers);
		}
	}

	//apply shuffling to XML nodes
	for(var i=0;i<this.numChoices;i++)
	{
		choicesNode.removeChild(choiceNodes[i]);
	}
	for(i=0;i<this.numChoices;i++)
	{
		choicesNode.appendChild(choiceNodes[this.shuffleChoices[i]]);
	}
	if(this.type == 'm_n_x')
	{
		for(i=0;i<this.numAnswers;i++)
		{
			answersNode.removeChild(answerNodes[i]);
		}
		for(i=0;i<this.numAnswers;i++)
		{
			answersNode.appendChild(answerNodes[this.shuffleAnswers[i]]);
		}
	}

	//invert the shuffle so we can now tell where particular choices/answers went
	this.shuffleChoices = math.inverse(this.shuffleChoices);
	this.shuffleAnswers = math.inverse(this.shuffleAnswers);

	//fill marks matrix
	var matrix=[];
	var def;
	if(def = this.xml.selectSingleNode('marking/matrix').getAttribute('def'))
	{
		matrix = jme.evaluate(def,this.question.scope);
		switch(matrix.type) {
		case 'list':
			var numLists = 0;
			var numNumbers = 0;
			for(var i=0;i<matrix.value.length;i++) {
				switch(matrix.value[i].type) {
				case 'list':
					numLists++;
					break;
				case 'number':
					numNumbers++;
					break;
				default:
					throw(new Numbas.Error('part.mcq.matrix wrong type',matrix.value[i].type));
				}
			}
			if(numLists == matrix.value.length)
			{
				matrix = matrix.value.map(function(row){	//convert TNums to javascript numbers
					return row.value.map(function(e){return e.value;});
				});
			}
			else if(numNumbers == matrix.value.length)
			{
				matrix = matrix.value.map(function(e) {
					return [e.value];
				});
			}
			else {
				throw(new Numbas.Error('part.mcq.matrix mix of numbers and lists'));
			}
			matrix.rows = matrix.length;
			matrix.columns = matrix[0].length;
			break;
		case 'matrix':
			matrix = matrix.value;
			break;
		default:
			throw(new Numbas.Error('part.mcq.matrix not a list'));
		}
		if(matrix.length!=this.numChoices)
			throw(new Numbas.Error('part.mcq.matrix wrong size'));

		// take into account shuffling;
		var omatrix = matrix;
		var matrix = [];
		matrix.rows = omatrix.rows;
		matrix.columns = omatrix.columns;
		for(var i=0;i<this.numChoices;i++) {
			matrix[i]=[];
			if(omatrix[i].length!=this.numAnswers)
				throw(new Numbas.Error('part.mcq.matrix wrong size'));
		}
		for(var i=0; i<this.numChoices; i++) {
			for(var j=0;j<this.numAnswers; j++) {
				matrix[this.shuffleChoices[i]][this.shuffleAnswers[j]] = omatrix[i][j];
			}
		}

		if(this.type=='m_n_x')
			matrix = Numbas.matrixmath.transpose(matrix);

	}
	else
	{
		var matrixNodes = this.xml.selectNodes('marking/matrix/mark');
		for( i=0; i<matrixNodes.length; i++ )
		{
			var cell = {value: ""};
			tryGetAttribute(cell,null, matrixNodes[i], ['answerIndex', 'choiceIndex', 'value']);

			if(util.isFloat(cell.value))
				cell.value = parseFloat(cell.value);
			else
			{
				cell.value = jme.evaluate(cell.value,this.question.scope).value;
				if(!util.isFloat(cell.value))
					throw(new Numbas.Error('part.mcq.matrix not a number',this.path,cell.answerIndex,cell.choiceIndex));
				cell.value = parseFloat(cell.value);
			}

			//take into account shuffling
			cell.answerIndex = this.shuffleAnswers[cell.answerIndex];
			cell.choiceIndex = this.shuffleChoices[cell.choiceIndex];

			if(this.type == '1_n_2' || this.type == 'm_n_2')
			{	//for some reason, possible answers are recorded as choices in the multiple choice types.
				//switch the indices round, so we don't have to worry about this again
				cell.answerIndex = cell.choiceIndex;
				cell.choiceIndex = 0;
			}

			if(!matrix[cell.answerIndex])
				matrix[cell.answerIndex]=[];
			matrix[cell.answerIndex][cell.choiceIndex] = cell.value;
		}
	}
	settings.matrix = matrix;
	var distractors=[];
	var distractorNodes = this.xml.selectNodes('marking/distractors/distractor');
	for( i=0; i<distractorNodes.length; i++ )
	{
		var cell = {message: ""};
		tryGetAttribute(cell,null, distractorNodes[i], ['answerIndex', 'choiceIndex']);
		cell.message= $.xsl.transform(Numbas.xml.templates.question,distractorNodes[i]).string;
		cell.message= jme.contentsubvars(cell.message,question.scope);

		//take into account shuffling
		cell.answerIndex = this.shuffleAnswers[cell.answerIndex];
		cell.choiceIndex = this.shuffleChoices[cell.choiceIndex];

		if(this.type == '1_n_2' || this.type == 'm_n_2')
		{	//for some reason, possible answers are recorded as choices in the multiple choice types.
			//switch the indices round, so we don't have to worry about this again
			cell.answerIndex = cell.choiceIndex;
			cell.choiceIndex = 0;
		}

		if(!distractors[cell.answerIndex])
			distractors[cell.answerIndex]=[];
		distractors[cell.answerIndex][cell.choiceIndex] = cell.message;
	}
	settings.distractors = distractors;

	if(settings.maxAnswers==0)
	{
		if(this.type=='1_n_2')
			settings.maxAnswers = 1;
		else
			settings.maxAnswers = this.numAnswers * this.numChoices;
	}
	
	if(this.marks == 0)	//if marks not set explicitly
	{
		var flat = [];
		switch(this.type)
		{
		case '1_n_2':
			for(var i=0;i<matrix.length;i++)
			{
				flat.push(matrix[i][0]);
			}
			break;
		case 'm_n_2':
			for(var i=0;i<matrix.length;i++)
			{
				flat.push(matrix[i][0]);
			}
			break;
		case 'm_n_x':
			if(settings.displayType=='radiogroup')
			{
				for(var i=0;i<this.numChoices;i++)
				{
					var row = [];
					for(var j=0;j<this.numAnswers;j++)
					{
						row.push(matrix[j][i]);
					}
					row.sort();
					flat.push(row[row.length-1]);
				}
			}
			else
			{
				for(var i=0;i<matrix.length;i++)
				{
					flat = flat.concat(matrix[i]);
				}
			}
			break;
		}
		flat.sort();
		for(var i=flat.length-1; i>=0 && flat.length-1-i<settings.maxAnswers && flat[i]>0;i--)
		{
			this.marks+=flat[i];
		}
	}


	if(this.type == '1_n_2' || this.type == 'm_n_2')
	{	//because we swapped answers and choices round in the marking matrix
		this.numAnswers = this.numChoices;
		this.numChoices = 1;
		var flipped=true;
	}
	else
		var flipped=false;

	//restore saved choices
	if(loading)
	{
		this.stagedAnswer = [];
		for( i=0; i<this.numAnswers; i++ )
		{
			this.stagedAnswer.push([]);
			for( var j=0; j<this.numChoices; j++ )
			{
				this.stagedAnswer[i].push(false);
			}
		}
		for( i=0;i<this.numAnswers;i++)
		{
			for(j=0;j<this.numChoices;j++)
			{
				if(pobj.ticks[i][j])
					this.stagedAnswer[i][j]=true;
			}
		}
	}
	else
	{
		//ticks array - which answers/choices are selected?
		this.ticks = [];
		this.stagedAnswer = [];
		for( i=0; i<this.numAnswers; i++ )
		{
			this.ticks.push([]);
			this.stagedAnswer.push([]);
			for( var j=0; j<this.numChoices; j++ )
			{
				this.ticks[i].push(false);
				this.stagedAnswer[i].push(false);
			}
		}
	}


	//if this part has a minimum number of answers more than zero, then
	//we start in an error state
	this.wrongNumber = settings.minAnswers > 0;

	this.display = new Numbas.display.MultipleResponsePartDisplay(this);
}
MultipleResponsePart.prototype = /** @lends Numbas.parts.MultipleResponsePart.prototype */
{
	/** Student's last submitted answer/choice selections
	 * @type {Array.Array.<boolean>}
	 */
	ticks: [],
	
	/** Has the student given the wrong number of responses?
	 * @type {boolean}
	 */
	wrongNumber: false,

	/** Number of choices - used by `m_n_x` parts
	 * @type {number}
	 */
	numChoices: 0,

	/** Number of answers
	 * @type {number}
	 */
	numAnswers: 0,

	/** Properties set when the part is generated
	 * Extends {@link Numbas.parts.Part#settings}
	 * @property {boolean} maxMarksEnabled - is there a maximum number of marks the student can get?
	 * @property {number} minAnswers - minimum number of responses the student must select
	 * @property {number} maxAnswers - maxmimum number of responses the student must select
	 * @property {string} choiceOrder - order in which to display choices - either `random` or `fixed`
	 * @property {string} answerOrder - order in which to display answers - either `random` or `fixed`
	 * @property {Array.Array.<number>} matrix - marks for each answer/choice pair. Arranged as `matrix[answer][choice]`
	 * @property {string} displayType - how to display the response selectors. Can be `radiogroup` or `checkbox`
	 * @property {string} warningType - what to do if the student picks the wrong number of responses? Either `none` (do nothing), `prevent` (don't let the student submit), or `warn` (show a warning but let them submit)
	 */
	settings:
	{
		maxMarksEnabled: false,		//is there a maximum number of marks the student can get?
		minAnswers: '0',				//minimum number of responses student must select
		maxAnswers: '0',				//maximum ditto
		choiceOrder: '',			//order in which to display choices
		answerOrder: '',			//order in which to display answers
		matrix: [],					//marks matrix
		displayType: '',			//how to display the responses? can be: radiogroup, dropdownlist, buttonimage, checkbox, choicecontent
		warningType: ''				//what to do if wrong number of responses
	},

	/** Store the student's choices */
	storeAnswer: function(answerList)
	{
		this.setDirty(true);
		//get choice and answer 
		//in MR1_n_2 and MRm_n_2 parts, only the choiceindex matters
		var answerIndex = answerList[0];
		var choiceIndex = answerList[1];

		switch(this.settings.displayType)
		{
		case 'radiogroup':							//for radiogroup parts, only one answer can be selected.
		case 'dropdownlist':
			for(var i=0; i<this.numAnswers; i++)
			{
				this.stagedAnswer[i][choiceIndex]= i==answerIndex;
			}
			break;
		default:
			this.stagedAnswer[answerIndex][choiceIndex] = answerList[2];
		}
	},

	/** Save a copy of the student's answer as entered on the page, for use in marking.
	 */
	setStudentAnswer: function() {
		this.ticks = util.copyarray(this.stagedAnswer,true);
	},

	/** Mark the student's choices */
	mark: function()
	{
		if(this.stagedAnswer==undefined)
		{
			this.setCredit(0,R('part.marking.did not answer'));
			return false;
		}
		this.setCredit(0);

		this.numTicks = 0;
		var partScore = 0;
		for( i=0; i<this.numAnswers; i++ )
		{
			for(var j=0; j<this.numChoices; j++ )
			{
				if(this.ticks[i][j])
				{
					this.numTicks += 1;
				}
			}
		}

		this.wrongNumber = (this.numTicks<this.settings.minAnswers || (this.numTicks>this.settings.maxAnswers && this.settings.maxAnswers>0));
		if(this.wrongNumber) {
			this.setCredit(0,R('part.mcq.wrong number of choices'));
			return;
		}

		for( i=0; i<this.numAnswers; i++ )
		{
			for(var j=0; j<this.numChoices; j++ )
			{
				if(this.ticks[i][j])
				{
					partScore += this.settings.matrix[i][j];

					var row = this.settings.distractors[i];
					if(row)
						var message = row[j];
					var award = this.settings.matrix[i][j];
					if(award!=0) {
						if(!util.isNonemptyHTML(message) && award>0)
							message = R('part.mcq.correct choice');
						this.addCredit(award/this.marks,message);
					} else {
						this.markingComment(message);
					}
				}
			}
		}

		if(this.credit<=0)
			this.markingComment(R('part.marking.incorrect'));

		if(this.marks>0)
		{
			this.setCredit(Math.min(partScore,this.marks)/this.marks);	//this part might have a maximum number of marks which is less then the sum of the marking matrix
		}
	},

	/** Are the student's answers valid? Show a warning if they've picked the wrong number */
	validate: function()
	{
		if(this.wrongNumber)
		{
			switch(this.settings.warningType)
			{
			case 'prevent':
				this.giveWarning(R('part.mcq.wrong number of choices'));
				return false;
				break;
			case 'warn':
				this.giveWarning(R('part.mcq.wrong number of choices'));
				break;
			}
		}

		if(this.numTicks>0)
			return true;
		else
			this.giveWarning(R('part.mcq.no choices selected'));
			return false;
	},

	/** Reveal the correct answers, and any distractor messages for the student's choices 
	 * Extends {@link Numbas.parts.Part.revealAnswer}
	 */
	revealAnswer: function()
	{
		var row,message;
		for(var i=0;i<this.numAnswers;i++)
		{
			for(var j=0;j<this.numChoices;j++)
			{
				if((row = this.settings.distractors[i]) && (message=row[j]))
				{
					this.markingComment(message);
				}
			}
		}
	}
};
MultipleResponsePart.prototype.revealAnswer = util.extend(MultipleResponsePart.prototype.revealAnswer, Part.prototype.revealAnswer);

/** Gap-fill part: text with multiple input areas, each of which is its own sub-part, known as a 'gap'.
 * @constructor
 * @memberof Numbas.parts
 * @augments Numbas.parts.Part
 */
function GapFillPart(xml, path, question, parentPart, loading)
{
	var gapXML = this.xml.selectNodes('gaps/part');

	this.marks = 0;

	for( var i=0 ; i<gapXML.length; i++ )
	{
		var gap = createPart(gapXML[i], path+'g'+i, this.question, this, loading);
		gap.isGap = true;
		this.marks += gap.marks;
		this.gaps[i]=gap;
		this.answered = this.answered || gap.answered;
	}

	this.display = new Numbas.display.GapFillPartDisplay(this);
}	
GapFillPart.prototype = /** @lends Numbas.parts.GapFillPart.prototype */
{
	/** Included so the "no answer entered" error isn't triggered for the whole gap-fill part.
	 */
	stagedAnswer: 'something',

	/** Reveal the answers to all of the child gaps 
	 * Extends {@link Numbas.parts.Part.revealAnswer}
	 */
	revealAnswer: function(dontStore)
	{
		for(var i=0; i<this.gaps.length; i++)
			this.gaps[i].revealAnswer(dontStore);
	},

	/** Submit all of the child gaps.
	 *
	 * Sets `this.submitting = true` while submitting, so that child parts don't try to recalculate the score during marking.
	 */
	submit: function()
	{
		this.submitting = true;
		for(var i=0;i<this.gaps.length;i++)
		{
			this.gaps[i].submit();
		}
		this.submitting = false;
	},

	/** Mark this part - add up the scores from each of the child gaps.
	 */
	mark: function()
	{
		this.credit=0;
		if(this.marks>0)
		{
			for(var i=0; i<this.gaps.length; i++)
			{
				var gap = this.gaps[i];
				this.credit += gap.credit*gap.marks;
				if(this.gaps.length>1)
					this.markingComment(R('part.gapfill.feedback header',i+1));
				for(var j=0;j<gap.markingFeedback.length;j++)
				{
					var action = util.copyobj(gap.markingFeedback[j]);
					action.gap = i;
					this.markingFeedback.push(action);
				}
			}
			this.credit/=this.marks;
		}
	},

	/** Are the student's answers to all of the gaps valid?
	 * @returns {boolean}
	 */
	validate: function()
	{
		//go through all gaps, and if any one fails to validate then
		//whole part fails to validate
		var success = true;
		for(var i=0; i<this.gaps.length; i++)
			success = success && this.gaps[i].answered;

		return success;
	}
};
GapFillPart.prototype.submit = util.extend(GapFillPart.prototype.submit, Part.prototype.submit);
GapFillPart.prototype.revealAnswer = util.extend(GapFillPart.prototype.revealAnswer, Part.prototype.revealAnswer);

/** Information only part - no input, no marking, just display some content to the student. 
 * @constructor
 * @memberof Numbas.parts
 * @augments Numbas.parts.Part
 */
function InformationPart(xml, path, question, parentPart, loading)
{
	this.display = new Numbas.display.InformationPartDisplay(this);
	this.answered = true;
	this.isDirty = false;
}
InformationPart.prototype = /** @lends Numbas.parts.InformationOnlyPart.prototype */ {
	/** This part is always valid
	 * @returns {boolean} true
	 */
	validate: function() {
		this.answered = true;
		return true;
	},

	/** This part is never dirty
	 */
	setDirty: function() {
		this.isDirty = false;
	}
};


/** Associate part type names with their object constructors
 * @memberof Numbas.Question
 */
var partConstructors = Numbas.Question.partConstructors = {
	'CUEdt.JMEPart': JMEPart, 
	'jme': JMEPart,

	'CUEdt.PatternMatchPart': PatternMatchPart,
	'patternmatch': PatternMatchPart,

	'CUEdt.NumberEntryPart': NumberEntryPart,
	'numberentry': NumberEntryPart,
	'matrix': MatrixEntryPart,

	'CUEdt.MR1_n_2Part': MultipleResponsePart,
	'CUEdt.MRm_n_2Part': MultipleResponsePart,
	'CUEdt.MRm_n_xPart': MultipleResponsePart,
	'1_n_2': MultipleResponsePart,
	'm_n_2': MultipleResponsePart,
	'm_n_x': MultipleResponsePart,

	'CUEdt.GapFillPart': GapFillPart,
	'gapfill': GapFillPart,

	'CUEdt.InformationOnlyPart': InformationPart,
	'information': InformationPart
};

var extend = util.extend;
for(var pc in partConstructors)
	partConstructors[pc]=extend(Part,partConstructors[pc]);

});

Numbas.queueScript('jquery.mousewheel',['jquery'],function(module) {
/*! Copyright (c) 2011 Brandon Aaron (http://brandonaaron.net)
 * Licensed under the MIT License (LICENSE.txt).
 *
 * Thanks to: http://adomas.org/javascript-mouse-wheel/ for some pointers.
 * Thanks to: Mathias Bank(http://www.mathias-bank.de) for a scope bug fix.
 * Thanks to: Seamus Leahy for adding deltaX and deltaY
 *
 * Version: 3.0.6
 * 
 * Requires: 1.2.2+
 */

(function($) {

var types = ['DOMMouseScroll', 'mousewheel'];

if ($.event.fixHooks) {
    for ( var i=types.length; i; ) {
        $.event.fixHooks[ types[--i] ] = $.event.mouseHooks;
    }
}

$.event.special.mousewheel = {
    setup: function() {
        if ( this.addEventListener ) {
            for ( var i=types.length; i; ) {
                this.addEventListener( types[--i], handler, false );
            }
        } else {
            this.onmousewheel = handler;
        }
    },
    
    teardown: function() {
        if ( this.removeEventListener ) {
            for ( var i=types.length; i; ) {
                this.removeEventListener( types[--i], handler, false );
            }
        } else {
            this.onmousewheel = null;
        }
    }
};

$.fn.extend({
    mousewheel: function(fn) {
        return fn ? this.bind("mousewheel", fn) : this.trigger("mousewheel");
    },
    
    unmousewheel: function(fn) {
        return this.unbind("mousewheel", fn);
    }
});


function handler(event) {
    var orgEvent = event || window.event, args = [].slice.call( arguments, 1 ), delta = 0, returnValue = true, deltaX = 0, deltaY = 0;
    event = $.event.fix(orgEvent);
    event.type = "mousewheel";
    
    // Old school scrollwheel delta
    if ( orgEvent.wheelDelta ) { delta = orgEvent.wheelDelta/120; }
    if ( orgEvent.detail     ) { delta = -orgEvent.detail/3; }
    
    // New school multidimensional scroll (touchpads) deltas
    deltaY = delta;
    
    // Gecko
    if ( orgEvent.axis !== undefined && orgEvent.axis === orgEvent.HORIZONTAL_AXIS ) {
        deltaY = 0;
        deltaX = -1*delta;
    }
    
    // Webkit
    if ( orgEvent.wheelDeltaY !== undefined ) { deltaY = orgEvent.wheelDeltaY/120; }
    if ( orgEvent.wheelDeltaX !== undefined ) { deltaX = -1*orgEvent.wheelDeltaX/120; }
    
    // Add event and delta to the front of the arguments
    args.unshift(event, delta, deltaX, deltaY);
    
    return ($.event.dispatch || $.event.handle).apply(this, args);
}

})(jQuery);
});

/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/** @file A few functions to do with time and date, and also performance timing. Provides {@link Numbas.timing}. */

Numbas.queueScript('timing',['base'],function() {

/** @namespace Numbas.timing */

var timing = Numbas.timing = /** @lends Numbas.timing */ {
	
	/** Get the current date as a string in the user's locale
	 * @returns {string}
	 */
	displayDate: function()
	{
		return (new Date()).toLocaleDateString();
	},

	/** Convert a number of seconds to a string in `HH:MM:SS` format
	 * @param {number} time
	 * @returns {string}
	 */
	secsToDisplayTime: function( time )
	{		
		if(time<0)
			return '-'+Numbas.timing.secsToDisplayTime(-time);
		var hours = 0;
		var minutes = 0;
		var seconds = 0;
		
		var remainder = time % 3600;
		hours = ( time - remainder ) / 3600;	
		
		time = remainder;
		
		if (time>59)
		{
			remainder = time % 60;
			minutes = ( time - remainder ) / 60;
		}
		else
		{
			minutes = 0;
		}		
				
		seconds = Math.floor(remainder);
					
		if( minutes<=9 )
		{ 
			minutes = "0" + minutes;
		}
		
		if( seconds<=9 )
		{
			seconds = "0" + seconds;
		}
		
		displayTime = hours + ":" + minutes + ":" + seconds;
		return displayTime;	
	},

	/** A queue of timers
	 * @type {Date[]}
	 */
	timers: [],

	/** Timing messages - how long did each timer take?
	 * @type {string[]}
	 */
	messages: [],
	start: function()
	{
		timing.timers.push(new Date());
	},

	/** End the top timer on the queue
	 * @param {string} label - a description of the timer
	 */
	end: function(label)
	{
		var s='';
		for(var i=0;i<timing.timers.length;i++){s+='   ';}
		s+=(new Date())-timing.timers.pop();
		s+=' '+label;
		timing.messages.push(s);
		if(!timing.timers.length){timing.show();}
	},

	/** Show all timing messages through {@link Numbas.debug}*/
	show: function()
	{
		for(var x in timing.accs)
		{
			Numbas.debug(timing.accs[x].total+' '+x,true);
		}
		timing.accs = {};

		for(var i=0;i<timing.messages.length;i++)
		{
			Numbas.debug(timing.messages[i],true);
		}
		timing.messages = [];

	},

	/** Stress test a function by running it a lot of times and seeing how long it takes
	 * @param {function} f
	 * @param {number} times
	 */
	stress: function(f,times)
	{
		timing.start();
		for(var i=0;i<times;i++)
		{
			f();
		}
		timing.end();
	},

	/** Timing accumulators
	 * @see Numbas.timing.startacc}
	 */
	accs: {},

	/** Accumulators are for counting time spent in functions which don't take long to evaluate, but are called repeatedly.
	 * 
	 * Call this with the function's name when you start the function, and {@link Numbas.timing.endacc} with the same name just before returning a value.
	 *
	 * It copes with recursion automatically, so you don't need to worry about double counting
	 * @param {string} name
	 */
	startacc: function(name)
	{
		if(timing.accs[name]==undefined)
		{
			timing.accs[name] = {
				total: 0,
				go: 0
			}
		}
		var acc = timing.accs[name];
		acc.go+=1;
		if(acc.go>1) { return; }
		acc.start = new Date();
	},

	/** Stop accumulating runtime for a function
	 * @param {string} name
	 * @see Numbas.timing.startacc
	 */
	endacc: function(name)
	{
		var acc = timing.accs[name];
		if(!acc)
			throw(new Numbas.Error('timing.no accumulator',name));

		acc.go -= 1;
		if(acc.go==0)
		{
			var end = new Date();
			acc.total += (end - acc.start);
		}
	}
	

};

});

/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/** @file Display code. Provides {@link Numbas.display} */

Numbas.queueScript('display',['controls','math','xml','util','timing','jme','jme-display'],function() {
	var util = Numbas.util;
	var jme = Numbas.jme;

	var MathJaxQueue = MathJax.Callback.Queue(MathJax.Hub.Register.StartupHook('End',{}));

MathJax.Hub.Register.MessageHook("Math Processing Error",function(message){
	throw(new Numbas.Error(message[2].message));
});

	MathJax.Hub.Register.StartupHook("TeX Jax Ready",function () {

		var TEX = MathJax.InputJax.TeX;
		var currentScope = null;

		TEX.prefilterHooks.Add(function(data) {
			currentScope = $(data.script).parents('.jme-scope').first().data('jme-scope');
		});

		TEX.Definitions.Add({macros: {
			'var': 'JMEvar', 
			'simplify': 'JMEsimplify'
		}});

		TEX.Parse.Augment({
			JMEvar: function(name) {
				var expr = this.GetArgument(name);
				var scope = currentScope;

				try {
					var v = jme.evaluate(jme.compile(expr,scope),scope);

					var tex = jme.display.texify({tok: v});
				}catch(e) {
					throw(new Numbas.Error('mathjax.math processing error',e.message,expr));
				}
				var mml = TEX.Parse(tex,this.stack.env).mml();

				this.Push(mml);
			},

			JMEsimplify: function(name) {
				var rules = this.GetBrackets(name);
				if(rules===undefined)
					rules = 'all';
				var expr = this.GetArgument(name);

				var scope = currentScope;
				expr = jme.subvars(expr,scope);

				var tex = jme.display.exprToLaTeX(expr,rules,scope);
				var mml = TEX.Parse(tex,this.stack.env).mml();

				this.Push(mml);
			}
		})
	});

function resizeF() {
	var w = $.textMetrics(this).width;
	$(this).width(Math.max(w+30,60)+'px');
};

ko.bindingHandlers.horizontalSlideVisible = {
	init: function(element, valueAccessor) {
		var containerWidth = $(element).width();
		ko.utils.domData.set(element,'originalWidth',containerWidth);
		$(element).css({display:'inline-block', 'overflow-x': 'hidden'});

		var buttonWidth = $(element).children().outerWidth();
		$(element).children().css({width:buttonWidth});
	},
	update: function(element, valueAccessor) {
		var value = ko.utils.unwrapObservable(valueAccessor());
		var originalWidth = ko.utils.domData.get(element,'originalWidth');

		$(element).animate({width: value ? originalWidth : 0}, 1000);
	}
}

ko.bindingHandlers.niceNumber = {
	update: function(element,valueAccessor) {
		var n = ko.utils.unwrapObservable(valueAccessor());
		$(element).text(Numbas.math.niceNumber(n));
	}
}

ko.bindingHandlers.autosize = {
	init: function(element) {
		//resize text inputs to just fit their contents
		$(element).keyup(resizeF).keydown(resizeF).change(resizeF).each(resizeF);
		resizeF.apply(element);
	},
	update: function(element) {
		resizeF.apply(element);
	}
}

ko.bindingHandlers.test = {
	update: function(element,valueAccessor) {
		console.log(ko.utils.unwrapObservable(valueAccessor()));
	}
}
ko.bindingHandlers.dom = {
	update: function(element,valueAccessor) {
		var html = ko.utils.unwrapObservable(valueAccessor());
		$(element).children().remove();
		$(element).append(html);
	}
}

ko.bindingHandlers.slideVisible = {
	init: function(element,valueAccessor) {
		var v = ko.utils.unwrapObservable(valueAccessor());
		$(element).toggle(v);
	},
		
	update: function(element,valueAccessor) {
		var v = ko.utils.unwrapObservable(valueAccessor());
		if(v)
			$(element).stop().slideDown('fast');
		else
			$(element).stop().slideUp('fast');
	}
}

ko.bindingHandlers.fadeVisible = {
	init: function(element,valueAccessor) {
		var v = ko.utils.unwrapObservable(valueAccessor());
		$(element).toggle(v);
	},
		
	update: function(element,valueAccessor) {
		var v = ko.utils.unwrapObservable(valueAccessor());
		if(v)
			$(element).stop().fadeIn();
		else
			$(element).stop().fadeOut();
	}
}

ko.bindingHandlers.latex = {
	update: function(element,valueAccessor) {
		ko.bindingHandlers.html.update.apply(this,arguments);
		Numbas.display.typeset(element);
	}
}

ko.bindingHandlers.maths = {
	update: function(element,valueAccessor) {
		var val = ko.utils.unwrapObservable(valueAccessor());
		$(element).html('<script type="math/tex">'+val+'</script>');
		Numbas.display.typeset(element);
	}
}

ko.bindingHandlers.typeset = {
	update: function(element, valueAccessor) {
		ko.utils.unwrapObservable(valueAccessor());
		Numbas.display.typeset(element);
	}
}

ko.bindingHandlers.pulse = {
	init: function() {
	},
	update: function(element,valueAccessor) {
		valueAccessor()();
		$(element).stop(true).animate({opacity:0},200).animate({opacity:1},200);
	}
};

ko.bindingHandlers.carousel = {
	update: function() {

	}
}

ko.bindingHandlers.hover = {
	init: function(element,valueAccessor) {
		var val = valueAccessor();
		val(false);
		$(element).hover(
			function() {
				val(true);
			},
			function() {
				val(false)
			}
		);
	}
}

ko.bindingHandlers.realVisible = ko.bindingHandlers.visible;

ko.bindingHandlers.visible = {
	init: function(element,valueAccessor) {
		$(element).css('display','');
		ko.utils.domData.set(element,'tabindex',$(element).attr('tabindex'));
	},
	update: function(element,valueAccessor) {
		var val = ko.unwrap(valueAccessor());
		$(element).toggleClass('invisible',!val);
		$(element).attr('disabled',!val);
		if(val) {
			$(element).attr('tabindex',ko.utils.domData.get(element,'tabindex'));
		}
		else {
			$(element).removeAttr('tabindex');
		}
	}
}

ko.bindingHandlers.visibleIf = {
	init: function(element,valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
		var val = ko.utils.unwrapObservable(valueAccessor());
		if(val && !ko.utils.domData.get(element,'visible-if-happened')) {
			ko.applyBindingsToDescendants(bindingContext,element);
			ko.utils.domData.set(element,'visible-if-happened',true);
		}
		$(element).toggleClass('invisible',!val);
		return {controlsDescendantBindings: true};
	},
	update:function(element,valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
		var val = ko.utils.unwrapObservable(valueAccessor());
		if(val && !ko.utils.domData.get(element,'visible-if-happened')) {
			ko.applyBindingsToDescendants(bindingContext,element);
			ko.utils.domData.set(element,'visible-if-happened',true);
		}
		$(element).toggleClass('invisible',!val);
	}
}

ko.bindingHandlers.stopbinding = {
	init: function() {
		return {controlsDescendantBindings: true};
	}
}

ko.components.register('matrix-input',{
	viewModel: function(params) {
		this.allowResize = params.allowResize ? params.allowResize : ko.observable(false);
		if(typeof params.rows=='function') {
			this.numRows = params.rows;
		} else {
			this.numRows = ko.observable(params.rows || 2);
		}
		if(typeof params.columns=='function') {
			this.numColumns = params.columns;
		} else {
			this.numColumns = ko.observable(params.columns || 2);
		}
		this.value = ko.observableArray([]);

		this.disable = params.disable || false;
		
		this.update = function() {
			// update value when number of rows or columns changes
			var numRows = parseInt(this.numRows());
			var numColumns = parseInt(this.numColumns());
			
			var value = this.value();
			value.splice(numRows,value.length-numRows);
			for(var i=0;i<numRows;i++) {
				var row;
				if(value.length<=i) {
					row = [];
					value.push(ko.observableArray(row));
				} else {
					row = value[i]();
				}
				row.splice(numColumns,row.length-numColumns);
				
				for(var j=0;j<numColumns;j++) {
					var cell;
					if(row.length<=j) {
						cell = ko.observable('');
						row.push({cell:cell});
					} else {
						cell = row[j];
					}
				}
				value[i](row);
			}
			this.value(value);
		}

		ko.computed(this.update,this);
		
		// update model with value
		ko.computed(function() {
			var v = params.value();
			var ov = this.value();
			this.numRows(v.length);
			this.numColumns(v[0] ? v[0].length : 0);
			for(var i=0;i<v.length;i++) {
				var row = v[i];
				for(var j=0;j<row.length;j++) {
					var cell = row[j];
					if(i<ov.length && j<ov[i]().length) {
						ov[i]()[j].cell(cell);
					}
				}
			}
		},this);
		
		var firstGo = true;
		//update value with model
		ko.computed(function() {
			var v = this.value().map(function(row,i){
				return row().map(function(cell,j){return cell.cell()})
			})
			if(firstGo) {
				firstGo = false;
				return;
			}
			params.value(v);
		},this)
	},
	template: 
	 '<div class="matrix-input">'
	+'	<!-- ko if: allowResize --><div class="matrix-size">'
	+'		<label class="num-rows">Rows: <input type="number" min="1" data-bind="value: numRows, autosize: true, disable: disable"/></label>'
	+'		<label class="num-columns">Columns: <input type="number" min="1" data-bind="value: numColumns, autosize: true, disable: disable"/></label>'
	+'	</div><!-- /ko -->'
	+'	<div class="matrix-wrapper">'
	+'		<span class="left-bracket"></span>'
	+'		<table class="matrix" data-bind="foreach: value">'
	+'			<tr data-bind="foreach: $data">'
	+'				<td class="cell"><input data-bind="value: cell, valueUpdate: \'afterkeydown\', autosize: true, disable: $parents[1].disable"></td>'
	+'			</tr>'
	+'		</table>'
	+'		<span class="right-bracket"></span>'
	+'	</div>'
	+'</div>'
	}
)

/** @namespace Numbas.display */

var display = Numbas.display = /** @lends Numbas.display */ {

	/** Localise strings in page HTML - for tags with an attribute `data-localise`, run that attribute through R.js to localise it, and replace the tag's HTML with the result
	 */
	localisePage: function() {
		$('[data-localise]').each(function() {
			var localString = R($(this).data('localise'));
			$(this).html(localString);
		})
	},

	/** Update the progress bar when loading
	 */
	showLoadProgress: function()
	{
		var p= 100 * Numbas.schedule.completed / Numbas.schedule.total;
		$('#progressbar #completed').width(p+'%');
	},

	/** Initialise the display. Called as soon as the page loads.
	 */
	init: function()
	{
		//hide the various content-display bits
		$('.mainDisplay > *').hide();
		//show the page;
		$('#loading').hide();
		$('#everything').show();

		ko.applyBindings(Numbas.exam.display);
		for(var i=0;i<Numbas.exam.questionList.length;i++) {
			Numbas.exam.display.applyQuestionBindings(Numbas.exam.questionList[i]);
		}

		$(document).keydown( function(e)
		{
			if(!Numbas.exam.inProgress) { return; }

			if($('input:focus').length || $('#jqibox').is(':visible'))
				return;
			
			switch(e.keyCode)
			{
			case 37:
				Numbas.controls.previousQuestion();
				break;
			case 39:
				Numbas.controls.nextQuestion();
				break;
			}
		});
		Numbas.exam.display.questions().map(function(q) {
			q.init();
		});
	},

	/** Does an input element currently have focus?
	 * @type {boolean}
	 */
	inInput: false,

	//alert / confirm boxes
	//

	/** Show an alert dialog
	 * @param {string} msg - message to show the user
	 * @param {function} fnOK - callback when OK is clicked
	 */
	showAlert: function(msg,fnOK) {
		fnOK = fnOK || function() {};
		$.prompt(msg,{overlayspeed: 'fast', close: function() {
			fnOK();
		}});
	},

	/** Show a confirmation dialog box
	 * @param {string} msg - message to show the user
	 * @param {function} fnOK - callback if OK is clicked
	 * @param {function} fnCancel - callback if cancelled
	 */
	showConfirm: function(msg,fnOK,fnCancel) {
		fnOK = fnOK || function(){};
		fnCancel = fnCancel || function(){};

		$.prompt(msg,{overlayspeed: 'fast', buttons:{Ok:true,Cancel:false},submit: function(e,val){
				val ? fnOK() : fnCancel(); 
		}});
	},

	/** Make MathJax typeset any maths in the selector
	 * @param {jQuery_selection} [selector] - elements to typeset. If not given, the whole page is typeset
	 * @param {function} callback - function to call when typesetting is finished
	 */
	typeset: function(selector,callback)
	{
		try
		{
			if(!selector)
				selector = $('body');

			$(selector).each(function(i,elem) {
				MathJaxQueue.Push(['Typeset',MathJax.Hub,elem]);
			});
			if(callback)
				MathJaxQueue.Push(callback);
		}
		catch(e)
		{
			if(MathJax===undefined && !display.failedMathJax)
			{
				display.failedMathJax = true;
				display.showAlert("Failed to load MathJax. Maths will not be typeset properly.\n\nIf you are the exam author, please check that you are connected to the internet, or modify the theme to load a local copy of MathJax. Instructions for doing this are given in the manual.");
			}
			else
			{
				Numbas.showError(e);
			}
		};
	},

	/** The Numbas exam has failed so much it can't continue - show an error message and the error
	 * @param {Error} e
	 */
	die: function(e) {
		var message = (e || e.message)+'';
		var stack = e.stack.replace(/\n/g,'<br>\n');
		Numbas.debug(message+' <br> '+stack);

		//hide all the non-error stuff
		$('.mainDisplay > *,#loading,#everything').hide();

		//show the error stuff
		$('#die').show();

		$('#die .error .message').html(message);
		$('#die .error .stack').html(stack);
	}

};

/** Display properties of the {@link Numbas.Exam} object.
 * @name ExamDisplay
 * @memberof Numbas.display
 * @constructor
 * @param {Numbas.Exam} e - associated exam
 * 
 */
display.ExamDisplay = function(e) 
{
	this.exam=e;

	/** The exam's mode ({@link Numbas.Exam#mode})
	 * @member {observable|string} mode
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.mode = ko.observable(e.mode);
	
	/** Is {@link Numbas.store} currently saving?
	 * @member {observable|boolean} saving
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.saving = ko.observable(false);

	/** The name of the currently displayed info page
	 * @member {observable|string} infoPage
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.infoPage = ko.observable(null);

	/** The current question ({@link Numbas.Exam#currentQuestion})
	 * @member {observable|Numbas.Question} currentQuestion
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.currentQuestion = ko.observable(null);

	/** The number of the current question
	 * @member {observable|number} currentQuestionNumber 
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.currentQuestionNumber = ko.computed(function() {
		var q = this.currentQuestion();
		if(q)
			return q.question.number;
		else
			return null;
	},this);

	/** All the exam's question display objects
	 * @member {observable|Numbas.display.QuestionDisplay[]} questions
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.questions = ko.observableArray([]);

	/** Can the student go back to the previous question? (False if the current question is the first one
	 * @member {observable|boolean} canReverse
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.canReverse = ko.computed(function() {
		return this.exam.settings.navigateReverse && this.currentQuestionNumber()>0;
	},this);
	
	/** Can the student go forward to the next question? (False if the current question is the last one)
	 * @member {observable|boolean} canAdvance
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.canAdvance = ko.computed(function() {
		return this.currentQuestionNumber()<this.exam.settings.numQuestions-1;
	},this);

	/** The student's total score ({@link Numbas.Exam#score})
	 * @member {observable|number} score
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.score = ko.observable(e.score);

	/** The total marks available for the exam ({@link Numbas.Exam#mark})
	 * @member {observable|number} marks
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.marks = ko.observable(e.mark);

	/** The percentage score the student needs to achieve to pass ({@link Numbas.Exam#percentPass}), formatted as a string.
	 * @member {observable|string} percentPass
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.percentPass = ko.observable(e.settings.percentPass*100+'%');

	/** String displaying the student's current score, and the total marks available, if allowed
	 * @member {observable|string} examScoreDisplay
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.examScoreDisplay = ko.computed(function() {
		var niceNumber = Numbas.math.niceNumber;
		var exam = this.exam;
		var score = this.score();
		var marks = this.marks();

		var totalExamScoreDisplay = '';
		if(exam.settings.showTotalMark)
			totalExamScoreDisplay = niceNumber(score)+'/'+niceNumber(marks);
		else
			totalExamScoreDisplay = niceNumber(score);

		return totalExamScoreDisplay;
	},this);

	/** The student's total score as a percentage of the total marks available
	 * @member {observable|number} percentScore
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.percentScore = ko.observable(0);

	/** The time left in the exam
	 * @member {observable|string} displayTime
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.displayTime = ko.observable('');

	/** The total time the student has spent in the exam
	 * @member {observable|string} timeSpent
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.timeSpent = ko.observable('');

	/** Is the student allowed to pause the exam?
	 * @member {boolean} allowPause
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.allowPause = e.settings.allowPause;

	/** Total number of questions the student attempted
	 * @member {observable|number} questionsAttempted
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.questionsAttempted = ko.computed(function() {
		return this.questions().reduce(function(s,q) { 
			return s + (q.answered() ? 1 : 0); 
		},0);
	},this);

	/** Total number of questions the student attempted, formatted as a fraction of the total number of questions
	 * @member {observable|string} questionsAttemptedDisplay
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.questionsAttemptedDisplay = ko.computed(function() {
		return this.questionsAttempted()+' / '+this.exam.settings.numQuestions;
	},this);

	/** The result of the exam - passed or failed?
	 * @member {observable|string} result
	 * @memberof Numbas.display.ExamDisplay
	 */
	this.result = ko.observable('');

	document.title = e.settings.name;

}
display.ExamDisplay.prototype = /** @lends Numbas.display.ExamDisplay.prototype */
{
	/** Reference to the associated exam object
	 * @type {Numbas.Exam}
	 */
	exam: undefined,

	/** Update the timer */
	showTiming: function()
	{
		this.displayTime(R('timing.time remaining',Numbas.timing.secsToDisplayTime(this.exam.timeRemaining)));
		this.timeSpent(Numbas.timing.secsToDisplayTime(this.exam.timeSpent));
	},

	/** Initialise the question list display */
	initQuestionList: function() {
		for(var i=0; i<this.exam.questionList.length; i++) {
			this.questions.push(this.exam.questionList[i].display);
		}
	},

	/** Hide the timer */
	hideTiming: function()
	{
		this.displayTime('');
	},

	/** Show/update the student's total score */
	showScore: function()
	{
		var exam = this.exam;
		this.marks(Numbas.math.niceNumber(exam.mark));
		this.score(Numbas.math.niceNumber(exam.score));
		this.percentScore(exam.percentScore);
	},

	/** Update the question list display - typically, scroll so the current question is visible */
	updateQuestionMenu: function()
	{
		var exam = this.exam;
		//scroll question list to centre on current question
		if(display.carouselGo)
			display.carouselGo(exam.currentQuestion.number-1,300);
	},

	/** Show an info page (one of the front page, pause , results, or exit)
	 * @param {string} page - name of the page to show
	 */
	showInfoPage: function(page)
	{
		window.onbeforeunload = null;

		this.infoPage(page);
		this.currentQuestion(null);

		var exam = this.exam;

		//scroll back to top of screen
		scroll(0,0);

		switch(page)
		{
		case "frontpage":
			this.marks(exam.mark);

			break;

		case "result":
			this.result(exam.result);
			
			break;

		case "suspend":
			this.showScore();

			break;
		
		case "exit":
			break;
		}
	},

	/** Show the current question */
	showQuestion: function()
	{
		var exam = this.exam;

		this.infoPage(null);
		this.currentQuestion(exam.currentQuestion.display);

		if(exam.settings.preventLeave && this.mode() != 'review')
			window.onbeforeunload = function() { return R('control.confirm leave') };
		else
			window.onbeforeunload = null;

		exam.currentQuestion.display.show();
		if(!this.madeCarousel)
		{
			display.carouselGo = makeCarousel($('.questionList'),{step: 2, nextBtn: '.questionMenu .next', prevBtn: '.questionMenu .prev'});
			this.madeCarousel = true;
		}
	},

	/** Called just before the current question is regenerated */
	startRegen: function() {
		$('#questionDisplay').hide();
		this.exam.currentQuestion.display.html.remove();
		this.oldQuestion = this.exam.currentQuestion.display;
	},
	
	/** Called after the current question has been regenerated */
	endRegen: function() {
		var currentQuestion = this.exam.currentQuestion;
		this.questions.splice(currentQuestion.number,1,currentQuestion.display);
		this.applyQuestionBindings(currentQuestion);
		$('#questionDisplay').fadeIn(200);
	},

	applyQuestionBindings: function(question) {
		ko.applyBindings({exam: this, question: question.display},question.display.html[0]);
	},

	/** Called when the exam ends */
	end: function() {
		this.mode(this.exam.mode);
		this.questions().map(function(q) {
			q.end();
		});
	}
};

/** Display properties of a question object
 * @name QuestionDisplay
 * @memberof Numbas.display
 * @constructor
 * @param {Numbas.Question} q - the associated question object
 */
display.QuestionDisplay = function(q)
{
	this.question = q;
	var exam = q.exam;

	/** Has the advice been shown?
	 * @member {observable|boolean} adviceDisplayed
	 * @memberof Numbas.display.QuestionDisplay
	 */
	this.adviceDisplayed = ko.observable(false);

	/** Get the {@link Numbas.display.PartDisplay} object for the given path.
	 * @param {partpath} path
	 * @returns {Numbas.display.PartDisplay}
	 * @method getPart
	 * @memberof Numbas.display.QuestionDisplay
	 */
	this.getPart = function(path) {
		return q.getPart(path).display;
	}

	/** Text for the "submit all answers" button
	 * @member {observable|string} submitMessage
	 * @memberof Numbas.display.QuestionDisplay
	 */
	this.submitMessage = ko.observable('');

	/** The name to display for this question - in default locale, it's "Question {N}"
	 * @member {observable|string} displayName
	 * @memberof Numbas.display.QuestionDisplay
	 */
	this.displayName = ko.observable(R('question.header',q.number+1));

	/** Has the student looked at this question? ({@link Numbas.Question#visited})
	 * @member {observable|boolean} visited
	 * @memberof Numbas.display.QuestionDisplay
	 */
	this.visited = ko.observable(q.visited);

	/** Is this question visible in the list?
	 * @member {observable|boolean} visible
	 * @memberof Numbas.display.QuestionDisplay
	 */
	this.visible = ko.computed(function() {
		return this.visited() || exam.settings.navigateBrowse;
	},this);

	/** Student's current score ({@link Numbas.Question#score})
	 * @member {observable|number} score
	 * @memberof Numbas.display.QuestionDisplay
	 */
	this.score = ko.observable(q.score);

	/** Total marks available for this question ({@link Numbas.Question#marks})
	 * @member {observable|number} marks
	 * @memberof Numbas.display.QuestionDisplay
	 */
	this.marks = ko.observable(q.marks);

	/** Has this question been answered? ({@link Numbas.Question#answered})
	 * @member {observable|boolean} answered
	 * @memberof Numbas.display.QuestionDisplay
	 */
	this.answered = ko.observable(q.answered);

	/** Have the correct answers been revealed? ({@link Numbas.Question#revealed})
	 * @member {observable|boolean} revealed
	 * @memberof Numbas.display.QuestionDisplay
	 */
	this.revealed = ko.observable(q.revealed);

	/** Have any of this question's parts been answered?
	 * @member {observable|boolean} anyAnswered
	 * @memberof Numbas.display.QuestionDisplay
	 */
	this.anyAnswered = ko.observable(false);

	/** Has the student changed any of their answers since submitting?
	 * @member {observable|boolean} isDirty
	 * @memberof Numbas.display.QuestionDisplay
	 */
	this.isDirty = ko.observable(false);

	/** Is the student able to reveal the correct answers?
	 * @member {observable|boolean} canReveal
	 * @memberof Numbas.display.QuestionDisplay
	 */
	this.canReveal = ko.computed(function() {
		return exam.settings.allowRevealAnswer && !this.revealed();
	},this);

	/** Score feedback string
	 * @member {{update: function, message: observable|string}} scoreFeedback
	 * @memberof Numbas.display.QuestionDisplay
	 */
	this.scoreFeedback = showScoreFeedback(this,q.exam.settings);

	/** Show this question in review mode
	 * @member {function} review
	 * @method
	 * @memberof Numbas.display.QuestionDisplay
	 */
	this.review = function() {
		exam.reviewQuestion(q.number);
	}
}
display.QuestionDisplay.prototype = /** @lends Numbas.display.QuestionDisplay.prototype */
{
	/** The associated question object
	 * @type {Numbas.Question}
	 */
	question: undefined,			//reference back to the main question object

	/** HTML representing the question
	 * @type {Element}
	 */
	html: '',						//HTML for displaying question

	/** Make the HTML to display the question */
	makeHTML: function() {
		var q = this.question;
		var qd = this;
		var html = this.html = $($.xsl.transform(Numbas.xml.templates.question, q.xml).string);
		html.addClass('jme-scope').data('jme-scope',q.scope);
		$('#questionDisplay').append(html);

		qd.css = document.createElement('style');
		qd.css.setAttribute('type','text/css');
		if(qd.css.styleSheet) {
			qd.css.styleSheet.cssText = q.preamble.css;
		} else {
			qd.css.appendChild(document.createTextNode(q.preamble.css));
		}

		Numbas.schedule.add(function()
		{
			html.each(function(e) {
				Numbas.jme.variables.DOMcontentsubvars(this,q.scope);
			})

			// trigger a signal that the question HTML is attached
			// DEPRECATED: use question.onHTMLAttached(fn) instead
			$('body').trigger('question-html-attached',q,qd);
			$('body').unbind('question-html-attached');

			// make mathjax process the question text (render the maths)
			Numbas.display.typeset(qd.html,qd.postTypesetF);
		});
	},

	/** Show the question */
	show: function()
	{
		var q = this.question;
		var qd = this;
		var exam = q.exam;

		this.html.append(this.css);

		this.visited(q.visited);

		//update the question menu - highlight this question, etc.
		exam.display.updateQuestionMenu();

		switch(exam.mode) {
		case 'normal':
			this.submitMessage( R(q.parts.length<=1 ? 'control.submit answer' : 'control.submit all parts') );
			break;
		case 'review':
			break;
		}

		//show parts
		this.postTypesetF = function(){};
		for(var i=0;i<q.parts.length;i++)
		{
			q.parts[i].display.show();
		}

		//display advice if appropriate
		this.showAdvice();

		//show correct answers if appropriate
		this.revealAnswer();
		
		//display score if appropriate
		this.showScore();
		
		//scroll back to top of page
		scroll(0,0);

		// make mathjax process the question text (render the maths)
		Numbas.display.typeset(this.html,this.postTypesetF);
	},

	/** Called when the student leaves the question */
	leave: function() {
		$(this.css).remove();
	},

	/** Show this question's advice */
	showAdvice: function( fromButton )
	{
		this.adviceDisplayed(this.question.adviceDisplayed);
	},

	/** Reveal the answers to this question */
	revealAnswer: function()
	{
		this.revealed(this.question.revealed);
		if(!this.question.revealed)
			return;
		scroll(0,0);
	},

	/** Display question score and answer state */
	showScore: function()
	{
		var q = this.question;
		var exam = q.exam;

		this.score(q.score);
		this.marks(q.marks);
		this.answered(q.answered);
		this.scoreFeedback.update(true);

		var anyAnswered = false;
		for(var i=0;i<q.parts.length;i++)
		{
			anyAnswered |= q.parts[i].answered;
		}
		this.anyAnswered(anyAnswered);
	},

	/** Scroll to the first part submission error */
	scrollToError: function() {
		scrollTo($('.warning-icon:visible:first'));
	},

	/* Initialise this question's display 
	 * @see Numbas.display.ExamDisplay.init
	 */
	init: function() {
		var q = this.question;
		for(var i=0;i<q.parts.length;i++)
		{
			q.parts[i].display.init();
		}
	},

	/** Called when the exam ends */
	end: function() {
		var q = this.question;
		for(var i=0;i<q.parts.length;i++)
		{
			q.parts[i].display.end();
		}
	}
};

var extend = Numbas.util.extend;

/** Display methods for a generic question part
 * @name PartDisplay
 * @memberof Numbas.display
 * @constructor
 * @param {Numbas.parts.Part} p - the associated part object
 */
display.PartDisplay = function(p)
{

	var pd = this;
	/** The associated part object
	 * @member {Numbas.parts.Part} part
	 * @memberof Numbas.display.PartDisplay
	 */
	this.part = p;

	/** The question this part belongs to
	 * @member {Numbas.Question} question
	 * @memberof Numbas.display.PartDisplay
	 */
	this.question = p.question;

	/** The student's current score ({@link Numbas.parts.Part#score})
	 * @member {observable|number} score
	 * @memberof Numbas.display.PartDisplay
	 */
	this.score = ko.observable(p.score);

	/** The total marks available for this part ({@link Numbas.parts.Part#marks})
	 * @member {observable|number} marks
	 * @memberof Numbas.display.PartDisplay
	 */
	this.marks = ko.observable(p.marks);

	/** Has the student answered this part?
	 * @member {observable|boolean} answered
	 * @memberof Numbas.display.PartDisplay
	 */
	this.answered = ko.observable(p.answered);

	/** Has the student changed their answer since the last submission?
	 * @member {observable|boolean} isDirty
	 * @memberof Numbas.display.PartDisplay
	 */
	this.isDirty = ko.observable(false);

	/** Warnings based on the student's answer
	 * @member {observable|Array.<{message:string}>} warnings
	 * @memberof Numbas.display.PartDisplay
	 */
	this.warnings = ko.observableArray([]);

	/** Are the warnings visible?
	 * @member {observable|boolean} warningsShown
	 * @memberof Numbas.display.PartDisplay
	 */
	this.warningsShown = ko.observable(false);

	/** Show the warnings
	 * @member {function} showWarnings
	 * @method
	 * @memberof Numbas.display.PartDisplay
	 */
	this.showWarnings = function() {
		this.warningsShown(true);
	}

	/** Hide the warnings
	 * @member {function} hideWarnings
	 * @method
	 * @memberof Numbas.display.PartDisplay
	 */
	this.hideWarnings = function() {
		this.warningsShown(false);
	}

	/** Are the marking feedback messages visible?
	 * @member {observable|boolean} feedbackShown
	 * @memberof Numbas.display.PartDisplay
	 */
	this.feedbackShown = ko.observable(false);

	/** Text for the button to toggle the display of the feedback messages
	 * @member {observable|string} toggleFeedbackText
	 * @memberof Numbas.display.PartDisplay
	 */
	this.toggleFeedbackText = ko.computed(function() {
		return R(this.feedbackShown() ? 'question.score feedback.hide' : 'question.score feedback.show');
	},this);

	/** Feedback messages
	 * @member {observable|string[]} feedbackMessages
	 * @memberof Numbas.display.PartDisplay
	 */
	this.feedbackMessages = ko.observableArray([]);
	
	/** Should the button to toggle feedback messages be shown?
	 * @member {observable|boolean} showFeedbackToggler
	 * @memberof Numbas.display.PartDisplay
	 */
	this.showFeedbackToggler = ko.computed(function() {
		return p.question.exam.settings.showAnswerState && pd.feedbackMessages().length;
	});

	/** Have the steps ever been shown? ({@link Numbas.parts.Part#stepsShown})
	 * @member {observable|boolean} stepsShown
	 * @memberof Numbas.display.PartDisplay
	 */
	this.stepsShown = ko.observable(p.stepsShown);

	/** Are the steps currently open? ({@link Numbas.parts.Part#stepsOpen})
	 * @member {observable|boolean} stepsOpen
	 * @memberof Numbas.display.PartDisplay
	 */
	this.stepsOpen = ko.observable(p.stepsOpen);

	/** Text to describe the state of the steps penalty
	 * @member {observable|string} stepsPenaltyMessage
	 * @memberof Numbas.display.PartDisplay
	 */
	this.stepsPenaltyMessage = ko.computed(function() {
		if(this.stepsOpen())
			return R('question.hide steps no penalty');
		else if(this.part.settings.stepsPenalty==0)
			return R('question.show steps no penalty');
		else if(this.stepsShown())
			return R('question.show steps already penalised');
		else
			return R('question.show steps penalty',Numbas.math.niceNumber(this.part.settings.stepsPenalty),util.pluralise(this.part.settings.stepsPenalty,R('mark'),R('marks')));
	},this);

	/** Have the correct answers been revealed?
	 * @member {observable|boolean} revealed
	 * @memberof Numbas.display.PartDisplay
	 */
	this.revealed = ko.observable(false);

	/** Should the correct answer be shown? True if revealed and {@link Numbas.parts.Part#settings.showCorrectAnswer}) is true
	 * @member {observable|boolean} showCorrectAnswer
	 * @memberof Numbas.display.PartDisplay
	 */
	this.showCorrectAnswer = ko.computed(function() {
		return p.settings.showCorrectAnswer && pd.revealed();
	});

	/** Display of this parts's current score / answered status
	 * @member {observable|object} scoreFeedback
	 * @memberof Numbas.display.PartDisplay
	 */
	this.scoreFeedback = showScoreFeedback(this,p.question.exam.settings);

	/** Control functions
	 * @member {object} controls
	 * @memberof Numbas.display.PartDisplay
	 * @property {function} toggleFeedback - Toggle the display of the marking feedback messages
	 * @property {function} submit - Submit the student's answers for marking
	 * @property {function} showSteps - Show the steps
	 * @property {function} hideSteps - Hide the steps
	 */
	this.controls = {
		toggleFeedback: function() {
			pd.feedbackShown(!pd.feedbackShown());
		},
		submit: function() {
			var np = p;
			while(np.isGap)
				np = np.parentPart;
			np.display.removeWarnings();
			np.submit();
			if(!np.answered)
			{
				Numbas.display.showAlert(R('question.can not submit'));
			}
			Numbas.store.save();
		},
		showSteps: function() {
			p.showSteps();
		},
		hideSteps: function() {
			p.hideSteps();
		}
	}

	/** Event bindings
	 * @member {object} inputEvents
	 * @memberof Numbas.display.PartDisplay
	 */
	this.inputEvents = {
		keypress: function(context,e) {
			if(e.which==13) {
				pd.controls.submit();
			}
			else
				return true;
		}
	}
}
display.PartDisplay.prototype = /** @lends Numbas.display.PartDisplay.prototype */
{
	/** Show a warning message about this part
	 * @param {string} warning
	 */
	warning: function(warning)
	{
		this.warnings.push({message:warning+''});
	},

	/** Remove all previously displayed warnings */
	removeWarnings: function()
	{
		this.warnings([]);
	},

	/** Called when the part is displayed (basically when question is changed)
	 * @see Numbas.display.QuestionDisplay.show
	 */
	show: function()
	{
		var p = this.part;

		this.feedbackShown(false);

		this.showScore(this.part.answered);
	},

	/** Show/update the student's score and answer status on this part */
	showScore: function(valid)
	{
		var p = this.part;
		var exam = p.question.exam;

		this.score(p.score);
		this.marks(p.marks);
		this.scoreFeedback.update(true);

		if(valid===undefined)
			valid = this.part.validate();
		this.answered(valid);

		if(exam.settings.showAnswerState)
		{
			if(this.part.markingFeedback.length && !this.part.question.revealed)
			{
				var messages = [];
				var maxMarks = this.part.marks - (this.part.stepsShown ? this.part.settings.stepsPenalty : 0);
				var t = 0;
				for(var i=0;i<this.part.markingFeedback.length;i++)
				{
					var action = this.part.markingFeedback[i];
					var change = 0;

					switch(action.op) {
					case 'addCredit':
						change = action.credit*maxMarks;
						if(action.gap!=undefined)
							change *= this.part.gaps[action.gap].marks/this.part.marks;
						t += change;
						break;
					}

					var message = action.message || '';
					if(util.isNonemptyHTML(message))
					{
						var marks = R('feedback.marks',Numbas.math.niceNumber(Math.abs(change)),util.pluralise(change,R('mark'),R('marks')));

						if(change>0)
							message+='\n\n'+R('feedback.you were awarded',marks);
						else if(change<0)
							message+='\n\n'+R('feedback.taken away',marks,util.pluralise(change,R('was'),R('were')));
					}
					if(util.isNonemptyHTML(message))
						messages.push(message);
				}
				
				this.feedbackMessages(messages);
			}
		}
	},

	/** Called when 'show steps' button is pressed, or coming back to a part after steps shown */
	showSteps: function()
	{
		this.stepsShown(this.part.stepsShown);
		this.stepsOpen(this.part.stepsOpen);

		for(var i=0;i<this.part.steps.length;i++)
		{
			this.part.steps[i].display.show();
		}
	},

	/** Hide the steps */
	hideSteps: function()
	{
		this.stepsOpen(this.part.stepsOpen);
	},

	/** Fill the student's last submitted answer into inputs
	 * @abstract
	 */
	restoreAnswer: function() 
	{
	},

	/** Show the correct answers to this part */
	revealAnswer: function() 
	{
		this.revealed(true);
		this.removeWarnings();
		this.showScore();
	},

	/** Initialise this part's display
	 * @see Numbas.display.QuestionDisplay.init
	 */
	init: function() {
		this.part.setDirty(false);
		for(var i=0;i<this.part.steps.length;i++) {
			this.part.steps[i].display.init();
		}
	},

	/** Called when the exam ends */
	end: function() {
		this.restoreAnswer();
		for(var i=0;i<this.part.steps.length;i++) {
			this.part.steps[i].display.end();
		}
	}
};

/** Display code for a {@link Numbas.parts.JMEPart}
 * @constructor
 * @augments Numbas.display.PartDisplay
 * @name JMEPartDisplay
 * @memberof Numbas.display
 */
display.JMEPartDisplay = function()
{
	var p = this.part;

	/** The student's current answer (not necessarily submitted)
	 * @member {observable|JME} studentAnswer
	 * @memberof Numbas.display.JMEPartDisplay
	 */
	this.studentAnswer = ko.observable('');

	/** The correct answer
	 * @member {observable|JME} correctAnswer
	 * @memberof Numbas.display.JMEPartDisplay
	 */
	this.correctAnswer = p.settings.correctAnswer;

	/** Should the LaTeX rendering of the student's answer be shown?
	 * @member {boolean} showPreview
	 * @memberof Numbas.display.JMEPartDisplay
	 */
	this.showPreview = p.settings.showPreview;

	/** The correct answer, in LaTeX form
	 * @member {observable|TeX} correctAnswerLaTeX
	 * @memberof Numbas.display.JMEPartDisplay
	 */
	this.correctAnswerLaTeX = Numbas.jme.display.exprToLaTeX(this.correctAnswer,p.settings.displaySimplification,p.question.scope);

	ko.computed(function() {
		p.storeAnswer([this.studentAnswer()]);
	},this);

	/** The student's answer, in LaTeX form
	 * @member {observable|TeX} studentAnswerLaTeX
	 * @memberof Numbas.display.JMEPartDisplay
	 */
	this.studentAnswerLaTeX = ko.computed(function() {
		var studentAnswer = this.studentAnswer();
		if(studentAnswer=='')
			return '';

		this.removeWarnings();

		try {
			var tex = Numbas.jme.display.exprToLaTeX(studentAnswer,p.settings.displaySimplification,p.question.scope);
			if(tex===undefined)
				throw(new Numbas.Error('display.part.jme.error making maths'));

		}
		catch(e) {
			this.warning(e.message);
			return '';
		}

		if(p.settings.checkVariableNames) {
			var tree = Numbas.jme.compile(studentAnswer,p.question.scope);
			var usedvars = Numbas.jme.findvars(tree);
			var failExpectedVariableNames = false;
			var unexpectedVariableName;
			for(var i=0;i<usedvars.length;i++) {
				if(!p.settings.expectedVariableNames.contains(usedvars[i])) {
					failExpectedVariableNames = true;
					unexpectedVariableName = usedvars[i];
					break;
				}
			}
			if( failExpectedVariableNames ) {
				var suggestedNames = unexpectedVariableName.split(Numbas.jme.re.re_short_name);
				if(suggestedNames.length>3) {
					var suggestion = [];
					for(var i=1;i<suggestedNames.length;i+=2) {
						suggestion.push(suggestedNames[i]);
					}
					suggestion = suggestion.join('*');
					this.warning(R('part.jme.unexpected variable name suggestion',unexpectedVariableName,suggestion));
				}
				else
					this.warning(R('part.jme.unexpected variable name', unexpectedVariableName));
			}
		}

		return tex;
	},this).extend({throttle:100});

	/** Does the input box have focus?
	 * @member {observable|boolean} inputHasFocus
	 * @memberof Numbas.display.JMEPartDisplay
	 */
	this.inputHasFocus = ko.observable(false);

	/** Give the input box focus
	 * @member {function} focusInput
	 * @method
	 * @memberof Numbas.display.JMEPartDisplay
	 */
	this.focusInput = function() {
		this.inputHasFocus(true);
	}
}
display.JMEPartDisplay.prototype =
{
	restoreAnswer: function()
	{
		this.studentAnswer(this.part.studentAnswer);
	}
};
display.JMEPartDisplay = extend(display.PartDisplay,display.JMEPartDisplay,true);

/** Display code for a {@link Numbas.parts.PatternMatchPart}
 * @augments Numbas.display.PartDisplay
 * @constructor
 * @name PatternMatchPartDisplay
 * @memberof Numbas.display
 */
display.PatternMatchPartDisplay = function()
{
	var p = this.part;

	/** The student's current answer (not necessarily submitted)
	 * @member {observable|string} studentAnswer
	 * @memberof Numbas.display.PatternMatchPartDisplay
	 */
	this.studentAnswer = ko.observable(this.part.studentAnswer);

	/** The correct answer regular expression
	 * @member {observable|RegExp} correctAnswer
	 * @memberof Numbas.display.PatternMatchPartDisplay
	 */
	this.correctAnswer = ko.observable(p.settings.correctAnswer);

	/** A representative correct answer to display when answers are revealed
	 * @member {observable|string} displayAnswer
	 * @memberof Numbas.display.PatternMatchPartDisplay
	 */
	this.displayAnswer = ko.observable(p.settings.displayAnswer);

	ko.computed(function() {
		p.storeAnswer([this.studentAnswer()]);
	},this);
}
display.PatternMatchPartDisplay.prototype = 
{
	restoreAnswer: function()
	{
		this.studentAnswer(this.part.studentAnswer);
	}
};
display.PatternMatchPartDisplay = extend(display.PartDisplay,display.PatternMatchPartDisplay,true);

/** Display code for a {@link Numbas.parts.NumberEntryPart}
 * @augments Numbas.display.PartDisplay
 * @constructor
 * @name NumberEntryPartDisplay
 * @memberof Numbas.display
 */
display.NumberEntryPartDisplay = function()
{
	var p = this.part;

	/** The student's current (not necessarily submitted) answer
	 * @member {observable|string} studentAnswer
	 * @memberof Numbas.display.NumberEntryPartDisplay
	 */
	this.studentAnswer = ko.observable(p.studentAnswer);

	/** The correct answer
	 * @member {observable|number} correctAnswer
	 * @memberof Numbas.display.NumberEntryPartDisplay
	 */
	this.correctAnswer = ko.observable(p.settings.displayAnswer);

	ko.computed(function() {
		p.storeAnswer([this.studentAnswer()]);
	},this);

	/** Cleaned-up version of student answer (remove commas and trim whitespace)
	 * 
	 * Also check for validity and give warnings
	 * @member {observable|string} cleanStudentAnswer
	 * @memberof Numbas.display.NumberEntryPartDisplay
	 */
	this.cleanStudentAnswer = ko.computed(function() {
		var studentAnswer = p.cleanAnswer(this.studentAnswer());
		this.removeWarnings();
		if(studentAnswer=='')
			return '';

		if(p.settings.integerAnswer) {
			var dp = Numbas.math.countDP(studentAnswer);
			if(dp>0)
				this.warning(R('part.numberentry.answer not integer'));
		}
		if(!util.isNumber(studentAnswer,p.settings.allowFractions)) {
			this.warning(R('part.numberentry.answer not integer or decimal'));
			return '';
		}
		var n = parseFloat(studentAnswer);
		return n+'';
	},this);

	/** Show a LaTeX rendering of the answer?
	 * @member {boolean} showPreview
	 * @memberof Numbas.display.NumberEntryPartDisplay
	 */
	this.showPreview = false;

	/** TeX version of student's answer
	 * @member {observable|TeX} studentAnswerLaTeX
	 * @memberof Numbas.display.NumberEntryPartDisplay
	 */
	this.studentAnswerLaTeX = ko.computed(function() {
		return this.cleanStudentAnswer();
	},this);

	/** Does the input box have focus?
	 * @member {observable|boolean} inputHasFocus
	 * @memberof Numbas.display.NumberEntryPartDisplay
	 */
	this.inputHasFocus = ko.observable(false);

	/** Give the input box focus
	 * @member {function} focusInput
	 * @method
	 * @memberof Numbas.display.NumberEntryPartDisplay
	 */
	this.focusInput = function() {
		this.inputHasFocus(true);
	}
}
display.NumberEntryPartDisplay.prototype =
{
	restoreAnswer: function()
	{
		this.studentAnswer(this.part.studentAnswer);
	}
};
display.NumberEntryPartDisplay = extend(display.PartDisplay,display.NumberEntryPartDisplay,true);

/** Display code for a {@link Numbas.parts.MatrixEntryPart}
 * @augments Numbas.display.PartDisplay
 * @constructor
 * @name MatrixEntryPartDisplay
 * @memberof Numbas.display
 */
display.MatrixEntryPartDisplay = function()
{
	var p = this.part;

	/** The student's current (not necessarily submitted) answer
	 * @member {observable|string} studentAnswer
	 * @memberof Numbas.display.MatrixEntryPartDisplay
	 */
	this.studentAnswer = ko.observable(p.studentAnswer);

	/** The correct answer
	 * @member {observable|number} correctAnswer
	 * @memberof Numbas.display.MatrixEntryPartDisplay
	 */
	this.correctAnswer = ko.observable(p.settings.correctAnswer);
	this.correctAnswerLaTeX = ko.computed(function() {
		var correctAnswer = this.correctAnswer();
		var m = new Numbas.jme.types.TMatrix(correctAnswer);
		return Numbas.jme.display.texify({tok:m},{fractionnumbers: p.settings.correctAnswerFractions});
	},this);

	this.studentAnswerRows = ko.observable(p.settings.numRows);
	this.studentAnswerColumns = ko.observable(p.settings.numColumns);
	this.allowResize = ko.observable(p.settings.allowResize);

	ko.computed(function() {
		p.storeAnswer([this.studentAnswerRows(),this.studentAnswerColumns(),this.studentAnswer()]);
	},this);

	/** Show a LaTeX rendering of the answer?
	 * @member {boolean} showPreview
	 * @memberof Numbas.display.MatrixEntryPartDisplay
	 */
	this.showPreview = false;

	/** TeX version of student's answer
	 * @member {observable|TeX} studentAnswerLaTeX
	 * @memberof Numbas.display.MatrixEntryPartDisplay
	 */
	this.studentAnswerLaTeX = ko.computed(function() {
		return 'student answer latex';
	},this);
}
display.MatrixEntryPartDisplay.prototype =
{
	restoreAnswer: function()
	{
		this.studentAnswer(this.part.studentAnswer);
	}
};
display.MatrixEntryPartDisplay = extend(display.PartDisplay,display.MatrixEntryPartDisplay,true);

/** Display code for a {@link Numbas.parts.MultipleResponsePart}
 * @augments Numbas.display.PartDisplay
 * @constructor
 * @name MultipleResponsePartDisplay
 * @memberof Numbas.display
 */
display.MultipleResponsePartDisplay = function()
{
	var p = this.part;

	function makeTicker(answer,choice) {
		var obs = ko.observable(p.ticks[answer][choice]);
		ko.computed(function() {
			p.storeAnswer([answer,choice,obs()]);
		},p);
		return obs;
	}

	function makeRadioTicker(choice) {
		var obs = ko.observable(null);
		for(var i=0;i<p.numAnswers;i++) {
			if(p.ticks[i][choice])
				obs(i);
		}
		ko.computed(function() {
			var answer = parseInt(obs());
			p.storeAnswer([answer,choice]);
		},p);
		return obs;
	}
	function makeCheckboxTicker(answer,choice) {
		var obs = ko.observable(p.ticks[answer][choice]);
		ko.computed(function() {
			p.storeAnswer([answer,choice,obs()]);
		});
		return obs;
	}

	switch(p.type) {
	case '1_n_2':
		/** Index of student's current answer choice (not necessarily submitted)
		 * @member {observable|number} studentAnswer
		 * @memberof Numbas.display.MultipleResponsePartDisplay
		 */
		this.studentAnswer = ko.observable(null);
		for(var i=0;i<p.numAnswers;i++) {
			if(p.ticks[i][0])
				this.studentAnswer(i);
		}

		var oldAnswer = null;
		ko.computed(function() {
			var i = parseInt(this.studentAnswer());
			if(i!=oldAnswer && !isNaN(i)) {
				p.storeAnswer([i,0]);
				oldAnswer = i;
			}
		},this);

		var max = 0, maxi = -1;
		for(var i=0;i<p.numAnswers;i++) {
			if(p.settings.matrix[i][0]>max || maxi==-1) {
				max = p.settings.matrix[i][0];
				maxi = i;
			}
		}
		/** Index of the answer which gains the most marks
		 * @member {observable|number} correctAnswer
		 * @memberof Numbas.display.MultipleResponsePartDisplay
		 */
		this.correctAnswer = ko.observable(maxi);

		break;
	case 'm_n_2':
		/** For each choice, has the student selected it?
		 *
		 * For m_n_2 parts, this is a list of booleans. For m_n_x radiogroup parts, it's a list of indices. For m_n_x checkbox parts, it's a 2d array of booleans.
		 * @member {observable|boolean[]|number[]|Array.Array.<boolean>} ticks
		 * @memberof Numbas.display.MultipleResponsePartDisplay
		 */
		this.ticks = [];

		/** For each choice, should it be selected to get the most marks?
		 *
		 * For m_n_2 parts, this is a list of booleans. For m_n_x radiogroup parts, it's a list of indices. For m_n_x checkbox parts, it's a 2d array of booleans.
		 * @member {observable|boolean[]|number[]|Array.Array.<boolean>} ticks
		 * @memberof Numbas.display.MultipleResponsePartDisplay
		 */
		this.correctTicks = [];
		for(var i=0; i<p.numAnswers; i++) {
			this.ticks[i] = makeTicker(i,0);
			this.correctTicks[i] = p.settings.matrix[i][0]>0;
		}

		if(p.settings.warningType!='none') {
			ko.computed(function() {
				this.removeWarnings();
				var ticked = 0;
				this.ticks.map(function(tick) {
					ticked += tick() ? 1 : 0;
				});

				if(ticked<p.settings.minAnswers || ticked>p.settings.maxAnswers) {
					this.warning(R('part.mcq.wrong number of choices'));
				};
			},this);
		}

		break;
	case 'm_n_x':
		switch(p.settings.displayType) {
		case 'radiogroup':
			this.ticks = [];
			this.correctTicks = [];
			for(var i=0; i<p.numChoices; i++) {
				this.ticks.push(makeRadioTicker(i));
				var maxj=-1,max=0;
				for(var j=0;j<p.numAnswers; j++) {
					if(maxj==-1 || p.settings.matrix[j][i]>max) {
						maxj = j;
						max = p.settings.matrix[j][i];
					}
				}
				this.correctTicks.push(maxj);
			}
			break;
		case 'checkbox':
			this.ticks = [];
			this.correctTicks = [];
			for(var i=0; i<p.numAnswers; i++) {
				var row = [];
				this.ticks.push(row);
				var correctRow = [];
				this.correctTicks.push(correctRow);
				for(var j=0; j<p.numChoices; j++) {
					row.push(makeCheckboxTicker(i,j));
					correctRow.push(p.settings.matrix[i][j]>0);
				}
			}

			if(p.settings.warningType!='none') {
				ko.computed(function() {
					this.removeWarnings();
					var ticked = 0;
					this.ticks.map(function(row) {
						row.map(function(tick) {
							ticked += tick() ? 1 : 0;
						});
					});

					if(ticked<p.settings.minAnswers || ticked>p.settings.maxAnswers) {
						this.warning(R('part.mcq.wrong number of choices'));
					};
				},this);
			}

			break;
		}
		break;
	}
}
display.MultipleResponsePartDisplay.prototype =
{
	restoreAnswer: function()
	{
		var part = this.part;
		switch(part.type) {
		case '1_n_2':
			this.studentAnswer(null);
			for(var i=0;i<part.numAnswers; i++) {
				if(part.ticks[i][0])
					this.studentAnswer(i+'');
			}
			break;
		case 'm_n_2':
			for(var i=0; i<part.numAnswers; i++) {
				this.ticks[i](part.ticks[i][0]);
			}
			break;
		case 'm_n_x':
			switch(part.settings.displayType) {
			case 'radiogroup':
				for(var i=0; i<part.numAnswers; i++) {
					for(var j=0; j<part.numChoices; j++) {
						if(part.ticks[i][j]) {
							this.ticks[j](i+'');
						}
					}
				}
				break;
			case 'checkbox':
				for(var i=0; i<part.numAnswers; i++) {
					for(var j=0; j<part.numChoices; j++) {
						this.ticks[i][j](part.ticks[i][j]);
					}
				}
				break;
			}
			break;
		}
	}
};
display.MultipleResponsePartDisplay = extend(display.PartDisplay,display.MultipleResponsePartDisplay,true);


/** Display code for a {@link Numbas.parts.GapFillPart}
 * @augments Numbas.display.PartDisplay
 * @constructor
 * @name GapFillPartDisplay
 * @memberof Numbas.display
 */
display.GapFillPartDisplay = function()
{
}
display.GapFillPartDisplay.prototype =
{
	show: function()
	{
		for(var i=0;i<this.part.gaps.length; i++)
			this.part.gaps[i].display.show();
	},

	restoreAnswer: function()
	{
		for(var i=0;i<this.part.gaps.length; i++)
			this.part.gaps[i].display.restoreAnswer();
	},

	revealAnswer: function()
	{
	},

	init: function() {
		for(var i=0;i<this.part.gaps.length; i++)
			this.part.gaps[i].display.init();
	},

	end: function() {
		for(var i=0;i<this.part.gaps.length; i++)
			this.part.gaps[i].display.end();
	}
};
display.GapFillPartDisplay = extend(display.PartDisplay,display.GapFillPartDisplay,true);

/** Display code for a {@link Numbas.parts.InformationPart}
 * @augments Numbas.display.PartDisplay
 * @constructor
 * @name InformationPartDisplay
 * @memberof Numbas.display
 */
display.InformationPartDisplay = function()
{
}
display.InformationPartDisplay = extend(display.PartDisplay,display.InformationPartDisplay,true);


//get size of contents of an input
//from http://stackoverflow.com/questions/118241/calculate-text-width-with-javascript
$.textMetrics = function(el) {
	var h = 0, w = 0;

	var div = document.createElement('div');
	document.body.appendChild(div);
	$(div).css({
		position: 'absolute',
		left: -1000,
		top: -1000,
		display: 'none'
	});

	var val = $(el).val();
	val = val.replace(/ /g,'&nbsp;');
	$(div).html(val);
	var styles = ['font-size','font-style', 'font-weight', 'font-family','line-height', 'text-transform', 'letter-spacing'];
	$(styles).each(function() {
		var s = this.toString();
		$(div).css(s, $(el).css(s));
	});

	h = $(div).outerHeight();
	w = $(div).outerWidth();

	$(div).remove();

	var ret = {
	 height: h,
	 width: w
	};

	return ret;
}

//update a score feedback box
//selector - jQuery selector of element to update
//score - student's score
//marks - total marks available
//settings - object containing the following properties:
//	showTotalMark
//	showActualMark
//	showAnswerState
function showScoreFeedback(obj,settings)
{
	var niceNumber = Numbas.math.niceNumber;
	var scoreDisplay = '';

	var newScore = ko.observable(false);

	var answered = ko.computed(function() {
		return !obj.isDirty() && (obj.answered() || obj.score()>0);
	});

	var state = ko.computed(function() {
		var revealed = obj.revealed(), score = obj.score(), marks = obj.marks();

		if( marks>0 && (revealed || (settings.showAnswerState && answered())) ) {
			if(score<=0)
				return 'wrong';
			else if(score==marks)
				return 'correct';
			else
				return 'partial';
		}
		else {
			return 'none';
		}
	});

	return {
		update: ko.computed({
			read: function() {
				return newScore();
			},
			write: function() {
				newScore(!newScore());
			}
		}),
		message: ko.computed(function() {
			var revealed = obj.revealed(), score = obj.score(), marks = obj.marks();

			var scoreobj = {
				marks: niceNumber(marks),
				score: niceNumber(score),
				marksString: niceNumber(marks)+' '+util.pluralise(marks,R('mark'),R('marks')),
				scoreString: niceNumber(score)+' '+util.pluralise(score,R('mark'),R('marks'))
			};
			if(revealed && !answered())
				return R('question.score feedback.unanswered');
			else if(answered() && marks>0)
			{
				var str = 'question.score feedback.answered'
							+ (settings.showTotalMark ? ' total' : '')
							+ (settings.showActualMark ? ' actual' : '')
				return R(str,scoreobj);
			}
			else if(settings.showTotalMark) {
				return R('question.score feedback.unanswered total',scoreobj);
			}
			else
				return '';
		}),
		iconClass: ko.computed(function() {
			switch(state()) {
			case 'wrong':
				return 'icon-remove';
			case 'correct':
				return 'icon-ok';
			case 'partial':
				return 'icon-ok partial';
			}
		}),
		iconAttr: ko.computed(function() {
			return {title:R('question.score feedback.'+state())};
		})
	}
};

function scrollTo(el)
{
	if(!(el).length)
		return;
	var docTop = $(window).scrollTop();
	var docBottom = docTop + $(window).height();
	var elemTop = $(el).offset().top;
	if((elemTop-docTop < 50) || (elemTop>docBottom-50))
		$('html,body').animate({scrollTop: $(el).offset().top-50 });
}

/** Make a carousel out of a div containing a list
 * @param {Element} elem - div containing list to turn into a carousel
 * @param {object} options -`prevBtn`, `nextBtn` - selectors of buttons to move up and down, `speed`, `step`
 */
var makeCarousel = Numbas.display.makeCarousel = function(elem,options) {
	options = $.extend({
		prevBtn: null,
		nextBtn: null,
		speed: 200,
		step: 1
	}, options || {});

	var div = $(elem);
	var current = div.find('li:first');
	var going = false;
	var nextScroll = null;

	function scrollTo(i)
	{
		nextScroll = i;
		if(going)
			return;
		try {
			var listOffset = div.find('ul,ol').position().top;
			var listHeight = div.find('ul,ol').height();
		} catch(e) {
			return;
		}

		var lis = div.find('li');
		var divHeight = div.height();
		var maxI = 0;
		for(var j=0;j<lis.length;j++)
		{
			var y = lis.eq(j).position().top - listOffset;
			if(listHeight - y < divHeight)
			{
				maxI = j;
				break;
			}
		}
		i = Math.max(Math.min(i,maxI),0);

		var ocurrent = current;
		current = div.find('li').eq(i);
		var itemOffset = current.position().top - listOffset;
		if(itemOffset != div.scrollTop() && ocurrent != current)
		{
			going = true;
			nextScroll = null;
			div.animate({scrollTop: itemOffset},{
				duration: options.speed,
				complete: function() { 
					going = false;
					if(nextScroll != null)
						scrollTo(nextScroll);
				} 
			});
		}
	}

	function scrollUp() {
		var i = div.find('li').index(current) || 0;
		if(nextScroll!==null)
			i = Math.min(i,nextScroll);
		i = Math.max(i-options.step, 0);
		scrollTo(i);
	}
	function scrollDown() {
		var lis = div.find('li');
		var i = lis.index(current) || 0;
		if(nextScroll!==null)
			i = Math.max(i,nextScroll);
		i = Math.min(i+options.step,lis.length-1);
		scrollTo(i);
	}

	$(options.prevBtn).click(scrollUp);
	$(options.nextBtn).click(scrollDown);
	div.mousewheel(function(e,d) {
		d > 0 ? scrollUp() : scrollDown();
		return false;
	});

	return scrollTo;
};


});


Numbas.queueScript('jquery',[],function() {
/*! jQuery v1.10.2 | (c) 2005, 2013 jQuery Foundation, Inc. | jquery.org/license
//@ sourceMappingURL=jquery-1.10.2.min.map
*/
(function(e,t){var n,r,i=typeof t,o=e.location,a=e.document,s=a.documentElement,l=e.jQuery,u=e.$,c={},p=[],f="1.10.2",d=p.concat,h=p.push,g=p.slice,m=p.indexOf,y=c.toString,v=c.hasOwnProperty,b=f.trim,x=function(e,t){return new x.fn.init(e,t,r)},w=/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,T=/\S+/g,C=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,N=/^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/,k=/^<(\w+)\s*\/?>(?:<\/\1>|)$/,E=/^[\],:{}\s]*$/,S=/(?:^|:|,)(?:\s*\[)+/g,A=/\\(?:["\\\/bfnrt]|u[\da-fA-F]{4})/g,j=/"[^"\\\r\n]*"|true|false|null|-?(?:\d+\.|)\d+(?:[eE][+-]?\d+|)/g,D=/^-ms-/,L=/-([\da-z])/gi,H=function(e,t){return t.toUpperCase()},q=function(e){(a.addEventListener||"load"===e.type||"complete"===a.readyState)&&(_(),x.ready())},_=function(){a.addEventListener?(a.removeEventListener("DOMContentLoaded",q,!1),e.removeEventListener("load",q,!1)):(a.detachEvent("onreadystatechange",q),e.detachEvent("onload",q))};x.fn=x.prototype={jquery:f,constructor:x,init:function(e,n,r){var i,o;if(!e)return this;if("string"==typeof e){if(i="<"===e.charAt(0)&&">"===e.charAt(e.length-1)&&e.length>=3?[null,e,null]:N.exec(e),!i||!i[1]&&n)return!n||n.jquery?(n||r).find(e):this.constructor(n).find(e);if(i[1]){if(n=n instanceof x?n[0]:n,x.merge(this,x.parseHTML(i[1],n&&n.nodeType?n.ownerDocument||n:a,!0)),k.test(i[1])&&x.isPlainObject(n))for(i in n)x.isFunction(this[i])?this[i](n[i]):this.attr(i,n[i]);return this}if(o=a.getElementById(i[2]),o&&o.parentNode){if(o.id!==i[2])return r.find(e);this.length=1,this[0]=o}return this.context=a,this.selector=e,this}return e.nodeType?(this.context=this[0]=e,this.length=1,this):x.isFunction(e)?r.ready(e):(e.selector!==t&&(this.selector=e.selector,this.context=e.context),x.makeArray(e,this))},selector:"",length:0,toArray:function(){return g.call(this)},get:function(e){return null==e?this.toArray():0>e?this[this.length+e]:this[e]},pushStack:function(e){var t=x.merge(this.constructor(),e);return t.prevObject=this,t.context=this.context,t},each:function(e,t){return x.each(this,e,t)},ready:function(e){return x.ready.promise().done(e),this},slice:function(){return this.pushStack(g.apply(this,arguments))},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},eq:function(e){var t=this.length,n=+e+(0>e?t:0);return this.pushStack(n>=0&&t>n?[this[n]]:[])},map:function(e){return this.pushStack(x.map(this,function(t,n){return e.call(t,n,t)}))},end:function(){return this.prevObject||this.constructor(null)},push:h,sort:[].sort,splice:[].splice},x.fn.init.prototype=x.fn,x.extend=x.fn.extend=function(){var e,n,r,i,o,a,s=arguments[0]||{},l=1,u=arguments.length,c=!1;for("boolean"==typeof s&&(c=s,s=arguments[1]||{},l=2),"object"==typeof s||x.isFunction(s)||(s={}),u===l&&(s=this,--l);u>l;l++)if(null!=(o=arguments[l]))for(i in o)e=s[i],r=o[i],s!==r&&(c&&r&&(x.isPlainObject(r)||(n=x.isArray(r)))?(n?(n=!1,a=e&&x.isArray(e)?e:[]):a=e&&x.isPlainObject(e)?e:{},s[i]=x.extend(c,a,r)):r!==t&&(s[i]=r));return s},x.extend({expando:"jQuery"+(f+Math.random()).replace(/\D/g,""),noConflict:function(t){return e.$===x&&(e.$=u),t&&e.jQuery===x&&(e.jQuery=l),x},isReady:!1,readyWait:1,holdReady:function(e){e?x.readyWait++:x.ready(!0)},ready:function(e){if(e===!0?!--x.readyWait:!x.isReady){if(!a.body)return setTimeout(x.ready);x.isReady=!0,e!==!0&&--x.readyWait>0||(n.resolveWith(a,[x]),x.fn.trigger&&x(a).trigger("ready").off("ready"))}},isFunction:function(e){return"function"===x.type(e)},isArray:Array.isArray||function(e){return"array"===x.type(e)},isWindow:function(e){return null!=e&&e==e.window},isNumeric:function(e){return!isNaN(parseFloat(e))&&isFinite(e)},type:function(e){return null==e?e+"":"object"==typeof e||"function"==typeof e?c[y.call(e)]||"object":typeof e},isPlainObject:function(e){var n;if(!e||"object"!==x.type(e)||e.nodeType||x.isWindow(e))return!1;try{if(e.constructor&&!v.call(e,"constructor")&&!v.call(e.constructor.prototype,"isPrototypeOf"))return!1}catch(r){return!1}if(x.support.ownLast)for(n in e)return v.call(e,n);for(n in e);return n===t||v.call(e,n)},isEmptyObject:function(e){var t;for(t in e)return!1;return!0},error:function(e){throw Error(e)},parseHTML:function(e,t,n){if(!e||"string"!=typeof e)return null;"boolean"==typeof t&&(n=t,t=!1),t=t||a;var r=k.exec(e),i=!n&&[];return r?[t.createElement(r[1])]:(r=x.buildFragment([e],t,i),i&&x(i).remove(),x.merge([],r.childNodes))},parseJSON:function(n){return e.JSON&&e.JSON.parse?e.JSON.parse(n):null===n?n:"string"==typeof n&&(n=x.trim(n),n&&E.test(n.replace(A,"@").replace(j,"]").replace(S,"")))?Function("return "+n)():(x.error("Invalid JSON: "+n),t)},parseXML:function(n){var r,i;if(!n||"string"!=typeof n)return null;try{e.DOMParser?(i=new DOMParser,r=i.parseFromString(n,"text/xml")):(r=new ActiveXObject("Microsoft.XMLDOM"),r.async="false",r.loadXML(n))}catch(o){r=t}return r&&r.documentElement&&!r.getElementsByTagName("parsererror").length||x.error("Invalid XML: "+n),r},noop:function(){},globalEval:function(t){t&&x.trim(t)&&(e.execScript||function(t){e.eval.call(e,t)})(t)},camelCase:function(e){return e.replace(D,"ms-").replace(L,H)},nodeName:function(e,t){return e.nodeName&&e.nodeName.toLowerCase()===t.toLowerCase()},each:function(e,t,n){var r,i=0,o=e.length,a=M(e);if(n){if(a){for(;o>i;i++)if(r=t.apply(e[i],n),r===!1)break}else for(i in e)if(r=t.apply(e[i],n),r===!1)break}else if(a){for(;o>i;i++)if(r=t.call(e[i],i,e[i]),r===!1)break}else for(i in e)if(r=t.call(e[i],i,e[i]),r===!1)break;return e},trim:b&&!b.call("\ufeff\u00a0")?function(e){return null==e?"":b.call(e)}:function(e){return null==e?"":(e+"").replace(C,"")},makeArray:function(e,t){var n=t||[];return null!=e&&(M(Object(e))?x.merge(n,"string"==typeof e?[e]:e):h.call(n,e)),n},inArray:function(e,t,n){var r;if(t){if(m)return m.call(t,e,n);for(r=t.length,n=n?0>n?Math.max(0,r+n):n:0;r>n;n++)if(n in t&&t[n]===e)return n}return-1},merge:function(e,n){var r=n.length,i=e.length,o=0;if("number"==typeof r)for(;r>o;o++)e[i++]=n[o];else while(n[o]!==t)e[i++]=n[o++];return e.length=i,e},grep:function(e,t,n){var r,i=[],o=0,a=e.length;for(n=!!n;a>o;o++)r=!!t(e[o],o),n!==r&&i.push(e[o]);return i},map:function(e,t,n){var r,i=0,o=e.length,a=M(e),s=[];if(a)for(;o>i;i++)r=t(e[i],i,n),null!=r&&(s[s.length]=r);else for(i in e)r=t(e[i],i,n),null!=r&&(s[s.length]=r);return d.apply([],s)},guid:1,proxy:function(e,n){var r,i,o;return"string"==typeof n&&(o=e[n],n=e,e=o),x.isFunction(e)?(r=g.call(arguments,2),i=function(){return e.apply(n||this,r.concat(g.call(arguments)))},i.guid=e.guid=e.guid||x.guid++,i):t},access:function(e,n,r,i,o,a,s){var l=0,u=e.length,c=null==r;if("object"===x.type(r)){o=!0;for(l in r)x.access(e,n,l,r[l],!0,a,s)}else if(i!==t&&(o=!0,x.isFunction(i)||(s=!0),c&&(s?(n.call(e,i),n=null):(c=n,n=function(e,t,n){return c.call(x(e),n)})),n))for(;u>l;l++)n(e[l],r,s?i:i.call(e[l],l,n(e[l],r)));return o?e:c?n.call(e):u?n(e[0],r):a},now:function(){return(new Date).getTime()},swap:function(e,t,n,r){var i,o,a={};for(o in t)a[o]=e.style[o],e.style[o]=t[o];i=n.apply(e,r||[]);for(o in t)e.style[o]=a[o];return i}}),x.ready.promise=function(t){if(!n)if(n=x.Deferred(),"complete"===a.readyState)setTimeout(x.ready);else if(a.addEventListener)a.addEventListener("DOMContentLoaded",q,!1),e.addEventListener("load",q,!1);else{a.attachEvent("onreadystatechange",q),e.attachEvent("onload",q);var r=!1;try{r=null==e.frameElement&&a.documentElement}catch(i){}r&&r.doScroll&&function o(){if(!x.isReady){try{r.doScroll("left")}catch(e){return setTimeout(o,50)}_(),x.ready()}}()}return n.promise(t)},x.each("Boolean Number String Function Array Date RegExp Object Error".split(" "),function(e,t){c["[object "+t+"]"]=t.toLowerCase()});function M(e){var t=e.length,n=x.type(e);return x.isWindow(e)?!1:1===e.nodeType&&t?!0:"array"===n||"function"!==n&&(0===t||"number"==typeof t&&t>0&&t-1 in e)}r=x(a),function(e,t){var n,r,i,o,a,s,l,u,c,p,f,d,h,g,m,y,v,b="sizzle"+-new Date,w=e.document,T=0,C=0,N=st(),k=st(),E=st(),S=!1,A=function(e,t){return e===t?(S=!0,0):0},j=typeof t,D=1<<31,L={}.hasOwnProperty,H=[],q=H.pop,_=H.push,M=H.push,O=H.slice,F=H.indexOf||function(e){var t=0,n=this.length;for(;n>t;t++)if(this[t]===e)return t;return-1},B="checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",P="[\\x20\\t\\r\\n\\f]",R="(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",W=R.replace("w","w#"),$="\\["+P+"*("+R+")"+P+"*(?:([*^$|!~]?=)"+P+"*(?:(['\"])((?:\\\\.|[^\\\\])*?)\\3|("+W+")|)|)"+P+"*\\]",I=":("+R+")(?:\\(((['\"])((?:\\\\.|[^\\\\])*?)\\3|((?:\\\\.|[^\\\\()[\\]]|"+$.replace(3,8)+")*)|.*)\\)|)",z=RegExp("^"+P+"+|((?:^|[^\\\\])(?:\\\\.)*)"+P+"+$","g"),X=RegExp("^"+P+"*,"+P+"*"),U=RegExp("^"+P+"*([>+~]|"+P+")"+P+"*"),V=RegExp(P+"*[+~]"),Y=RegExp("="+P+"*([^\\]'\"]*)"+P+"*\\]","g"),J=RegExp(I),G=RegExp("^"+W+"$"),Q={ID:RegExp("^#("+R+")"),CLASS:RegExp("^\\.("+R+")"),TAG:RegExp("^("+R.replace("w","w*")+")"),ATTR:RegExp("^"+$),PSEUDO:RegExp("^"+I),CHILD:RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\("+P+"*(even|odd|(([+-]|)(\\d*)n|)"+P+"*(?:([+-]|)"+P+"*(\\d+)|))"+P+"*\\)|)","i"),bool:RegExp("^(?:"+B+")$","i"),needsContext:RegExp("^"+P+"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\("+P+"*((?:-\\d)?\\d*)"+P+"*\\)|)(?=[^-]|$)","i")},K=/^[^{]+\{\s*\[native \w/,Z=/^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,et=/^(?:input|select|textarea|button)$/i,tt=/^h\d$/i,nt=/'|\\/g,rt=RegExp("\\\\([\\da-f]{1,6}"+P+"?|("+P+")|.)","ig"),it=function(e,t,n){var r="0x"+t-65536;return r!==r||n?t:0>r?String.fromCharCode(r+65536):String.fromCharCode(55296|r>>10,56320|1023&r)};try{M.apply(H=O.call(w.childNodes),w.childNodes),H[w.childNodes.length].nodeType}catch(ot){M={apply:H.length?function(e,t){_.apply(e,O.call(t))}:function(e,t){var n=e.length,r=0;while(e[n++]=t[r++]);e.length=n-1}}}function at(e,t,n,i){var o,a,s,l,u,c,d,m,y,x;if((t?t.ownerDocument||t:w)!==f&&p(t),t=t||f,n=n||[],!e||"string"!=typeof e)return n;if(1!==(l=t.nodeType)&&9!==l)return[];if(h&&!i){if(o=Z.exec(e))if(s=o[1]){if(9===l){if(a=t.getElementById(s),!a||!a.parentNode)return n;if(a.id===s)return n.push(a),n}else if(t.ownerDocument&&(a=t.ownerDocument.getElementById(s))&&v(t,a)&&a.id===s)return n.push(a),n}else{if(o[2])return M.apply(n,t.getElementsByTagName(e)),n;if((s=o[3])&&r.getElementsByClassName&&t.getElementsByClassName)return M.apply(n,t.getElementsByClassName(s)),n}if(r.qsa&&(!g||!g.test(e))){if(m=d=b,y=t,x=9===l&&e,1===l&&"object"!==t.nodeName.toLowerCase()){c=mt(e),(d=t.getAttribute("id"))?m=d.replace(nt,"\\$&"):t.setAttribute("id",m),m="[id='"+m+"'] ",u=c.length;while(u--)c[u]=m+yt(c[u]);y=V.test(e)&&t.parentNode||t,x=c.join(",")}if(x)try{return M.apply(n,y.querySelectorAll(x)),n}catch(T){}finally{d||t.removeAttribute("id")}}}return kt(e.replace(z,"$1"),t,n,i)}function st(){var e=[];function t(n,r){return e.push(n+=" ")>o.cacheLength&&delete t[e.shift()],t[n]=r}return t}function lt(e){return e[b]=!0,e}function ut(e){var t=f.createElement("div");try{return!!e(t)}catch(n){return!1}finally{t.parentNode&&t.parentNode.removeChild(t),t=null}}function ct(e,t){var n=e.split("|"),r=e.length;while(r--)o.attrHandle[n[r]]=t}function pt(e,t){var n=t&&e,r=n&&1===e.nodeType&&1===t.nodeType&&(~t.sourceIndex||D)-(~e.sourceIndex||D);if(r)return r;if(n)while(n=n.nextSibling)if(n===t)return-1;return e?1:-1}function ft(e){return function(t){var n=t.nodeName.toLowerCase();return"input"===n&&t.type===e}}function dt(e){return function(t){var n=t.nodeName.toLowerCase();return("input"===n||"button"===n)&&t.type===e}}function ht(e){return lt(function(t){return t=+t,lt(function(n,r){var i,o=e([],n.length,t),a=o.length;while(a--)n[i=o[a]]&&(n[i]=!(r[i]=n[i]))})})}s=at.isXML=function(e){var t=e&&(e.ownerDocument||e).documentElement;return t?"HTML"!==t.nodeName:!1},r=at.support={},p=at.setDocument=function(e){var n=e?e.ownerDocument||e:w,i=n.defaultView;return n!==f&&9===n.nodeType&&n.documentElement?(f=n,d=n.documentElement,h=!s(n),i&&i.attachEvent&&i!==i.top&&i.attachEvent("onbeforeunload",function(){p()}),r.attributes=ut(function(e){return e.className="i",!e.getAttribute("className")}),r.getElementsByTagName=ut(function(e){return e.appendChild(n.createComment("")),!e.getElementsByTagName("*").length}),r.getElementsByClassName=ut(function(e){return e.innerHTML="<div class='a'></div><div class='a i'></div>",e.firstChild.className="i",2===e.getElementsByClassName("i").length}),r.getById=ut(function(e){return d.appendChild(e).id=b,!n.getElementsByName||!n.getElementsByName(b).length}),r.getById?(o.find.ID=function(e,t){if(typeof t.getElementById!==j&&h){var n=t.getElementById(e);return n&&n.parentNode?[n]:[]}},o.filter.ID=function(e){var t=e.replace(rt,it);return function(e){return e.getAttribute("id")===t}}):(delete o.find.ID,o.filter.ID=function(e){var t=e.replace(rt,it);return function(e){var n=typeof e.getAttributeNode!==j&&e.getAttributeNode("id");return n&&n.value===t}}),o.find.TAG=r.getElementsByTagName?function(e,n){return typeof n.getElementsByTagName!==j?n.getElementsByTagName(e):t}:function(e,t){var n,r=[],i=0,o=t.getElementsByTagName(e);if("*"===e){while(n=o[i++])1===n.nodeType&&r.push(n);return r}return o},o.find.CLASS=r.getElementsByClassName&&function(e,n){return typeof n.getElementsByClassName!==j&&h?n.getElementsByClassName(e):t},m=[],g=[],(r.qsa=K.test(n.querySelectorAll))&&(ut(function(e){e.innerHTML="<select><option selected=''></option></select>",e.querySelectorAll("[selected]").length||g.push("\\["+P+"*(?:value|"+B+")"),e.querySelectorAll(":checked").length||g.push(":checked")}),ut(function(e){var t=n.createElement("input");t.setAttribute("type","hidden"),e.appendChild(t).setAttribute("t",""),e.querySelectorAll("[t^='']").length&&g.push("[*^$]="+P+"*(?:''|\"\")"),e.querySelectorAll(":enabled").length||g.push(":enabled",":disabled"),e.querySelectorAll("*,:x"),g.push(",.*:")})),(r.matchesSelector=K.test(y=d.webkitMatchesSelector||d.mozMatchesSelector||d.oMatchesSelector||d.msMatchesSelector))&&ut(function(e){r.disconnectedMatch=y.call(e,"div"),y.call(e,"[s!='']:x"),m.push("!=",I)}),g=g.length&&RegExp(g.join("|")),m=m.length&&RegExp(m.join("|")),v=K.test(d.contains)||d.compareDocumentPosition?function(e,t){var n=9===e.nodeType?e.documentElement:e,r=t&&t.parentNode;return e===r||!(!r||1!==r.nodeType||!(n.contains?n.contains(r):e.compareDocumentPosition&&16&e.compareDocumentPosition(r)))}:function(e,t){if(t)while(t=t.parentNode)if(t===e)return!0;return!1},A=d.compareDocumentPosition?function(e,t){if(e===t)return S=!0,0;var i=t.compareDocumentPosition&&e.compareDocumentPosition&&e.compareDocumentPosition(t);return i?1&i||!r.sortDetached&&t.compareDocumentPosition(e)===i?e===n||v(w,e)?-1:t===n||v(w,t)?1:c?F.call(c,e)-F.call(c,t):0:4&i?-1:1:e.compareDocumentPosition?-1:1}:function(e,t){var r,i=0,o=e.parentNode,a=t.parentNode,s=[e],l=[t];if(e===t)return S=!0,0;if(!o||!a)return e===n?-1:t===n?1:o?-1:a?1:c?F.call(c,e)-F.call(c,t):0;if(o===a)return pt(e,t);r=e;while(r=r.parentNode)s.unshift(r);r=t;while(r=r.parentNode)l.unshift(r);while(s[i]===l[i])i++;return i?pt(s[i],l[i]):s[i]===w?-1:l[i]===w?1:0},n):f},at.matches=function(e,t){return at(e,null,null,t)},at.matchesSelector=function(e,t){if((e.ownerDocument||e)!==f&&p(e),t=t.replace(Y,"='$1']"),!(!r.matchesSelector||!h||m&&m.test(t)||g&&g.test(t)))try{var n=y.call(e,t);if(n||r.disconnectedMatch||e.document&&11!==e.document.nodeType)return n}catch(i){}return at(t,f,null,[e]).length>0},at.contains=function(e,t){return(e.ownerDocument||e)!==f&&p(e),v(e,t)},at.attr=function(e,n){(e.ownerDocument||e)!==f&&p(e);var i=o.attrHandle[n.toLowerCase()],a=i&&L.call(o.attrHandle,n.toLowerCase())?i(e,n,!h):t;return a===t?r.attributes||!h?e.getAttribute(n):(a=e.getAttributeNode(n))&&a.specified?a.value:null:a},at.error=function(e){throw Error("Syntax error, unrecognized expression: "+e)},at.uniqueSort=function(e){var t,n=[],i=0,o=0;if(S=!r.detectDuplicates,c=!r.sortStable&&e.slice(0),e.sort(A),S){while(t=e[o++])t===e[o]&&(i=n.push(o));while(i--)e.splice(n[i],1)}return e},a=at.getText=function(e){var t,n="",r=0,i=e.nodeType;if(i){if(1===i||9===i||11===i){if("string"==typeof e.textContent)return e.textContent;for(e=e.firstChild;e;e=e.nextSibling)n+=a(e)}else if(3===i||4===i)return e.nodeValue}else for(;t=e[r];r++)n+=a(t);return n},o=at.selectors={cacheLength:50,createPseudo:lt,match:Q,attrHandle:{},find:{},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(e){return e[1]=e[1].replace(rt,it),e[3]=(e[4]||e[5]||"").replace(rt,it),"~="===e[2]&&(e[3]=" "+e[3]+" "),e.slice(0,4)},CHILD:function(e){return e[1]=e[1].toLowerCase(),"nth"===e[1].slice(0,3)?(e[3]||at.error(e[0]),e[4]=+(e[4]?e[5]+(e[6]||1):2*("even"===e[3]||"odd"===e[3])),e[5]=+(e[7]+e[8]||"odd"===e[3])):e[3]&&at.error(e[0]),e},PSEUDO:function(e){var n,r=!e[5]&&e[2];return Q.CHILD.test(e[0])?null:(e[3]&&e[4]!==t?e[2]=e[4]:r&&J.test(r)&&(n=mt(r,!0))&&(n=r.indexOf(")",r.length-n)-r.length)&&(e[0]=e[0].slice(0,n),e[2]=r.slice(0,n)),e.slice(0,3))}},filter:{TAG:function(e){var t=e.replace(rt,it).toLowerCase();return"*"===e?function(){return!0}:function(e){return e.nodeName&&e.nodeName.toLowerCase()===t}},CLASS:function(e){var t=N[e+" "];return t||(t=RegExp("(^|"+P+")"+e+"("+P+"|$)"))&&N(e,function(e){return t.test("string"==typeof e.className&&e.className||typeof e.getAttribute!==j&&e.getAttribute("class")||"")})},ATTR:function(e,t,n){return function(r){var i=at.attr(r,e);return null==i?"!="===t:t?(i+="","="===t?i===n:"!="===t?i!==n:"^="===t?n&&0===i.indexOf(n):"*="===t?n&&i.indexOf(n)>-1:"$="===t?n&&i.slice(-n.length)===n:"~="===t?(" "+i+" ").indexOf(n)>-1:"|="===t?i===n||i.slice(0,n.length+1)===n+"-":!1):!0}},CHILD:function(e,t,n,r,i){var o="nth"!==e.slice(0,3),a="last"!==e.slice(-4),s="of-type"===t;return 1===r&&0===i?function(e){return!!e.parentNode}:function(t,n,l){var u,c,p,f,d,h,g=o!==a?"nextSibling":"previousSibling",m=t.parentNode,y=s&&t.nodeName.toLowerCase(),v=!l&&!s;if(m){if(o){while(g){p=t;while(p=p[g])if(s?p.nodeName.toLowerCase()===y:1===p.nodeType)return!1;h=g="only"===e&&!h&&"nextSibling"}return!0}if(h=[a?m.firstChild:m.lastChild],a&&v){c=m[b]||(m[b]={}),u=c[e]||[],d=u[0]===T&&u[1],f=u[0]===T&&u[2],p=d&&m.childNodes[d];while(p=++d&&p&&p[g]||(f=d=0)||h.pop())if(1===p.nodeType&&++f&&p===t){c[e]=[T,d,f];break}}else if(v&&(u=(t[b]||(t[b]={}))[e])&&u[0]===T)f=u[1];else while(p=++d&&p&&p[g]||(f=d=0)||h.pop())if((s?p.nodeName.toLowerCase()===y:1===p.nodeType)&&++f&&(v&&((p[b]||(p[b]={}))[e]=[T,f]),p===t))break;return f-=i,f===r||0===f%r&&f/r>=0}}},PSEUDO:function(e,t){var n,r=o.pseudos[e]||o.setFilters[e.toLowerCase()]||at.error("unsupported pseudo: "+e);return r[b]?r(t):r.length>1?(n=[e,e,"",t],o.setFilters.hasOwnProperty(e.toLowerCase())?lt(function(e,n){var i,o=r(e,t),a=o.length;while(a--)i=F.call(e,o[a]),e[i]=!(n[i]=o[a])}):function(e){return r(e,0,n)}):r}},pseudos:{not:lt(function(e){var t=[],n=[],r=l(e.replace(z,"$1"));return r[b]?lt(function(e,t,n,i){var o,a=r(e,null,i,[]),s=e.length;while(s--)(o=a[s])&&(e[s]=!(t[s]=o))}):function(e,i,o){return t[0]=e,r(t,null,o,n),!n.pop()}}),has:lt(function(e){return function(t){return at(e,t).length>0}}),contains:lt(function(e){return function(t){return(t.textContent||t.innerText||a(t)).indexOf(e)>-1}}),lang:lt(function(e){return G.test(e||"")||at.error("unsupported lang: "+e),e=e.replace(rt,it).toLowerCase(),function(t){var n;do if(n=h?t.lang:t.getAttribute("xml:lang")||t.getAttribute("lang"))return n=n.toLowerCase(),n===e||0===n.indexOf(e+"-");while((t=t.parentNode)&&1===t.nodeType);return!1}}),target:function(t){var n=e.location&&e.location.hash;return n&&n.slice(1)===t.id},root:function(e){return e===d},focus:function(e){return e===f.activeElement&&(!f.hasFocus||f.hasFocus())&&!!(e.type||e.href||~e.tabIndex)},enabled:function(e){return e.disabled===!1},disabled:function(e){return e.disabled===!0},checked:function(e){var t=e.nodeName.toLowerCase();return"input"===t&&!!e.checked||"option"===t&&!!e.selected},selected:function(e){return e.parentNode&&e.parentNode.selectedIndex,e.selected===!0},empty:function(e){for(e=e.firstChild;e;e=e.nextSibling)if(e.nodeName>"@"||3===e.nodeType||4===e.nodeType)return!1;return!0},parent:function(e){return!o.pseudos.empty(e)},header:function(e){return tt.test(e.nodeName)},input:function(e){return et.test(e.nodeName)},button:function(e){var t=e.nodeName.toLowerCase();return"input"===t&&"button"===e.type||"button"===t},text:function(e){var t;return"input"===e.nodeName.toLowerCase()&&"text"===e.type&&(null==(t=e.getAttribute("type"))||t.toLowerCase()===e.type)},first:ht(function(){return[0]}),last:ht(function(e,t){return[t-1]}),eq:ht(function(e,t,n){return[0>n?n+t:n]}),even:ht(function(e,t){var n=0;for(;t>n;n+=2)e.push(n);return e}),odd:ht(function(e,t){var n=1;for(;t>n;n+=2)e.push(n);return e}),lt:ht(function(e,t,n){var r=0>n?n+t:n;for(;--r>=0;)e.push(r);return e}),gt:ht(function(e,t,n){var r=0>n?n+t:n;for(;t>++r;)e.push(r);return e})}},o.pseudos.nth=o.pseudos.eq;for(n in{radio:!0,checkbox:!0,file:!0,password:!0,image:!0})o.pseudos[n]=ft(n);for(n in{submit:!0,reset:!0})o.pseudos[n]=dt(n);function gt(){}gt.prototype=o.filters=o.pseudos,o.setFilters=new gt;function mt(e,t){var n,r,i,a,s,l,u,c=k[e+" "];if(c)return t?0:c.slice(0);s=e,l=[],u=o.preFilter;while(s){(!n||(r=X.exec(s)))&&(r&&(s=s.slice(r[0].length)||s),l.push(i=[])),n=!1,(r=U.exec(s))&&(n=r.shift(),i.push({value:n,type:r[0].replace(z," ")}),s=s.slice(n.length));for(a in o.filter)!(r=Q[a].exec(s))||u[a]&&!(r=u[a](r))||(n=r.shift(),i.push({value:n,type:a,matches:r}),s=s.slice(n.length));if(!n)break}return t?s.length:s?at.error(e):k(e,l).slice(0)}function yt(e){var t=0,n=e.length,r="";for(;n>t;t++)r+=e[t].value;return r}function vt(e,t,n){var r=t.dir,o=n&&"parentNode"===r,a=C++;return t.first?function(t,n,i){while(t=t[r])if(1===t.nodeType||o)return e(t,n,i)}:function(t,n,s){var l,u,c,p=T+" "+a;if(s){while(t=t[r])if((1===t.nodeType||o)&&e(t,n,s))return!0}else while(t=t[r])if(1===t.nodeType||o)if(c=t[b]||(t[b]={}),(u=c[r])&&u[0]===p){if((l=u[1])===!0||l===i)return l===!0}else if(u=c[r]=[p],u[1]=e(t,n,s)||i,u[1]===!0)return!0}}function bt(e){return e.length>1?function(t,n,r){var i=e.length;while(i--)if(!e[i](t,n,r))return!1;return!0}:e[0]}function xt(e,t,n,r,i){var o,a=[],s=0,l=e.length,u=null!=t;for(;l>s;s++)(o=e[s])&&(!n||n(o,r,i))&&(a.push(o),u&&t.push(s));return a}function wt(e,t,n,r,i,o){return r&&!r[b]&&(r=wt(r)),i&&!i[b]&&(i=wt(i,o)),lt(function(o,a,s,l){var u,c,p,f=[],d=[],h=a.length,g=o||Nt(t||"*",s.nodeType?[s]:s,[]),m=!e||!o&&t?g:xt(g,f,e,s,l),y=n?i||(o?e:h||r)?[]:a:m;if(n&&n(m,y,s,l),r){u=xt(y,d),r(u,[],s,l),c=u.length;while(c--)(p=u[c])&&(y[d[c]]=!(m[d[c]]=p))}if(o){if(i||e){if(i){u=[],c=y.length;while(c--)(p=y[c])&&u.push(m[c]=p);i(null,y=[],u,l)}c=y.length;while(c--)(p=y[c])&&(u=i?F.call(o,p):f[c])>-1&&(o[u]=!(a[u]=p))}}else y=xt(y===a?y.splice(h,y.length):y),i?i(null,a,y,l):M.apply(a,y)})}function Tt(e){var t,n,r,i=e.length,a=o.relative[e[0].type],s=a||o.relative[" "],l=a?1:0,c=vt(function(e){return e===t},s,!0),p=vt(function(e){return F.call(t,e)>-1},s,!0),f=[function(e,n,r){return!a&&(r||n!==u)||((t=n).nodeType?c(e,n,r):p(e,n,r))}];for(;i>l;l++)if(n=o.relative[e[l].type])f=[vt(bt(f),n)];else{if(n=o.filter[e[l].type].apply(null,e[l].matches),n[b]){for(r=++l;i>r;r++)if(o.relative[e[r].type])break;return wt(l>1&&bt(f),l>1&&yt(e.slice(0,l-1).concat({value:" "===e[l-2].type?"*":""})).replace(z,"$1"),n,r>l&&Tt(e.slice(l,r)),i>r&&Tt(e=e.slice(r)),i>r&&yt(e))}f.push(n)}return bt(f)}function Ct(e,t){var n=0,r=t.length>0,a=e.length>0,s=function(s,l,c,p,d){var h,g,m,y=[],v=0,b="0",x=s&&[],w=null!=d,C=u,N=s||a&&o.find.TAG("*",d&&l.parentNode||l),k=T+=null==C?1:Math.random()||.1;for(w&&(u=l!==f&&l,i=n);null!=(h=N[b]);b++){if(a&&h){g=0;while(m=e[g++])if(m(h,l,c)){p.push(h);break}w&&(T=k,i=++n)}r&&((h=!m&&h)&&v--,s&&x.push(h))}if(v+=b,r&&b!==v){g=0;while(m=t[g++])m(x,y,l,c);if(s){if(v>0)while(b--)x[b]||y[b]||(y[b]=q.call(p));y=xt(y)}M.apply(p,y),w&&!s&&y.length>0&&v+t.length>1&&at.uniqueSort(p)}return w&&(T=k,u=C),x};return r?lt(s):s}l=at.compile=function(e,t){var n,r=[],i=[],o=E[e+" "];if(!o){t||(t=mt(e)),n=t.length;while(n--)o=Tt(t[n]),o[b]?r.push(o):i.push(o);o=E(e,Ct(i,r))}return o};function Nt(e,t,n){var r=0,i=t.length;for(;i>r;r++)at(e,t[r],n);return n}function kt(e,t,n,i){var a,s,u,c,p,f=mt(e);if(!i&&1===f.length){if(s=f[0]=f[0].slice(0),s.length>2&&"ID"===(u=s[0]).type&&r.getById&&9===t.nodeType&&h&&o.relative[s[1].type]){if(t=(o.find.ID(u.matches[0].replace(rt,it),t)||[])[0],!t)return n;e=e.slice(s.shift().value.length)}a=Q.needsContext.test(e)?0:s.length;while(a--){if(u=s[a],o.relative[c=u.type])break;if((p=o.find[c])&&(i=p(u.matches[0].replace(rt,it),V.test(s[0].type)&&t.parentNode||t))){if(s.splice(a,1),e=i.length&&yt(s),!e)return M.apply(n,i),n;break}}}return l(e,f)(i,t,!h,n,V.test(e)),n}r.sortStable=b.split("").sort(A).join("")===b,r.detectDuplicates=S,p(),r.sortDetached=ut(function(e){return 1&e.compareDocumentPosition(f.createElement("div"))}),ut(function(e){return e.innerHTML="<a href='#'></a>","#"===e.firstChild.getAttribute("href")})||ct("type|href|height|width",function(e,n,r){return r?t:e.getAttribute(n,"type"===n.toLowerCase()?1:2)}),r.attributes&&ut(function(e){return e.innerHTML="<input/>",e.firstChild.setAttribute("value",""),""===e.firstChild.getAttribute("value")})||ct("value",function(e,n,r){return r||"input"!==e.nodeName.toLowerCase()?t:e.defaultValue}),ut(function(e){return null==e.getAttribute("disabled")})||ct(B,function(e,n,r){var i;return r?t:(i=e.getAttributeNode(n))&&i.specified?i.value:e[n]===!0?n.toLowerCase():null}),x.find=at,x.expr=at.selectors,x.expr[":"]=x.expr.pseudos,x.unique=at.uniqueSort,x.text=at.getText,x.isXMLDoc=at.isXML,x.contains=at.contains}(e);var O={};function F(e){var t=O[e]={};return x.each(e.match(T)||[],function(e,n){t[n]=!0}),t}x.Callbacks=function(e){e="string"==typeof e?O[e]||F(e):x.extend({},e);var n,r,i,o,a,s,l=[],u=!e.once&&[],c=function(t){for(r=e.memory&&t,i=!0,a=s||0,s=0,o=l.length,n=!0;l&&o>a;a++)if(l[a].apply(t[0],t[1])===!1&&e.stopOnFalse){r=!1;break}n=!1,l&&(u?u.length&&c(u.shift()):r?l=[]:p.disable())},p={add:function(){if(l){var t=l.length;(function i(t){x.each(t,function(t,n){var r=x.type(n);"function"===r?e.unique&&p.has(n)||l.push(n):n&&n.length&&"string"!==r&&i(n)})})(arguments),n?o=l.length:r&&(s=t,c(r))}return this},remove:function(){return l&&x.each(arguments,function(e,t){var r;while((r=x.inArray(t,l,r))>-1)l.splice(r,1),n&&(o>=r&&o--,a>=r&&a--)}),this},has:function(e){return e?x.inArray(e,l)>-1:!(!l||!l.length)},empty:function(){return l=[],o=0,this},disable:function(){return l=u=r=t,this},disabled:function(){return!l},lock:function(){return u=t,r||p.disable(),this},locked:function(){return!u},fireWith:function(e,t){return!l||i&&!u||(t=t||[],t=[e,t.slice?t.slice():t],n?u.push(t):c(t)),this},fire:function(){return p.fireWith(this,arguments),this},fired:function(){return!!i}};return p},x.extend({Deferred:function(e){var t=[["resolve","done",x.Callbacks("once memory"),"resolved"],["reject","fail",x.Callbacks("once memory"),"rejected"],["notify","progress",x.Callbacks("memory")]],n="pending",r={state:function(){return n},always:function(){return i.done(arguments).fail(arguments),this},then:function(){var e=arguments;return x.Deferred(function(n){x.each(t,function(t,o){var a=o[0],s=x.isFunction(e[t])&&e[t];i[o[1]](function(){var e=s&&s.apply(this,arguments);e&&x.isFunction(e.promise)?e.promise().done(n.resolve).fail(n.reject).progress(n.notify):n[a+"With"](this===r?n.promise():this,s?[e]:arguments)})}),e=null}).promise()},promise:function(e){return null!=e?x.extend(e,r):r}},i={};return r.pipe=r.then,x.each(t,function(e,o){var a=o[2],s=o[3];r[o[1]]=a.add,s&&a.add(function(){n=s},t[1^e][2].disable,t[2][2].lock),i[o[0]]=function(){return i[o[0]+"With"](this===i?r:this,arguments),this},i[o[0]+"With"]=a.fireWith}),r.promise(i),e&&e.call(i,i),i},when:function(e){var t=0,n=g.call(arguments),r=n.length,i=1!==r||e&&x.isFunction(e.promise)?r:0,o=1===i?e:x.Deferred(),a=function(e,t,n){return function(r){t[e]=this,n[e]=arguments.length>1?g.call(arguments):r,n===s?o.notifyWith(t,n):--i||o.resolveWith(t,n)}},s,l,u;if(r>1)for(s=Array(r),l=Array(r),u=Array(r);r>t;t++)n[t]&&x.isFunction(n[t].promise)?n[t].promise().done(a(t,u,n)).fail(o.reject).progress(a(t,l,s)):--i;return i||o.resolveWith(u,n),o.promise()}}),x.support=function(t){var n,r,o,s,l,u,c,p,f,d=a.createElement("div");if(d.setAttribute("className","t"),d.innerHTML="  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>",n=d.getElementsByTagName("*")||[],r=d.getElementsByTagName("a")[0],!r||!r.style||!n.length)return t;s=a.createElement("select"),u=s.appendChild(a.createElement("option")),o=d.getElementsByTagName("input")[0],r.style.cssText="top:1px;float:left;opacity:.5",t.getSetAttribute="t"!==d.className,t.leadingWhitespace=3===d.firstChild.nodeType,t.tbody=!d.getElementsByTagName("tbody").length,t.htmlSerialize=!!d.getElementsByTagName("link").length,t.style=/top/.test(r.getAttribute("style")),t.hrefNormalized="/a"===r.getAttribute("href"),t.opacity=/^0.5/.test(r.style.opacity),t.cssFloat=!!r.style.cssFloat,t.checkOn=!!o.value,t.optSelected=u.selected,t.enctype=!!a.createElement("form").enctype,t.html5Clone="<:nav></:nav>"!==a.createElement("nav").cloneNode(!0).outerHTML,t.inlineBlockNeedsLayout=!1,t.shrinkWrapBlocks=!1,t.pixelPosition=!1,t.deleteExpando=!0,t.noCloneEvent=!0,t.reliableMarginRight=!0,t.boxSizingReliable=!0,o.checked=!0,t.noCloneChecked=o.cloneNode(!0).checked,s.disabled=!0,t.optDisabled=!u.disabled;try{delete d.test}catch(h){t.deleteExpando=!1}o=a.createElement("input"),o.setAttribute("value",""),t.input=""===o.getAttribute("value"),o.value="t",o.setAttribute("type","radio"),t.radioValue="t"===o.value,o.setAttribute("checked","t"),o.setAttribute("name","t"),l=a.createDocumentFragment(),l.appendChild(o),t.appendChecked=o.checked,t.checkClone=l.cloneNode(!0).cloneNode(!0).lastChild.checked,d.attachEvent&&(d.attachEvent("onclick",function(){t.noCloneEvent=!1}),d.cloneNode(!0).click());for(f in{submit:!0,change:!0,focusin:!0})d.setAttribute(c="on"+f,"t"),t[f+"Bubbles"]=c in e||d.attributes[c].expando===!1;d.style.backgroundClip="content-box",d.cloneNode(!0).style.backgroundClip="",t.clearCloneStyle="content-box"===d.style.backgroundClip;for(f in x(t))break;return t.ownLast="0"!==f,x(function(){var n,r,o,s="padding:0;margin:0;border:0;display:block;box-sizing:content-box;-moz-box-sizing:content-box;-webkit-box-sizing:content-box;",l=a.getElementsByTagName("body")[0];l&&(n=a.createElement("div"),n.style.cssText="border:0;width:0;height:0;position:absolute;top:0;left:-9999px;margin-top:1px",l.appendChild(n).appendChild(d),d.innerHTML="<table><tr><td></td><td>t</td></tr></table>",o=d.getElementsByTagName("td"),o[0].style.cssText="padding:0;margin:0;border:0;display:none",p=0===o[0].offsetHeight,o[0].style.display="",o[1].style.display="none",t.reliableHiddenOffsets=p&&0===o[0].offsetHeight,d.innerHTML="",d.style.cssText="box-sizing:border-box;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;padding:1px;border:1px;display:block;width:4px;margin-top:1%;position:absolute;top:1%;",x.swap(l,null!=l.style.zoom?{zoom:1}:{},function(){t.boxSizing=4===d.offsetWidth}),e.getComputedStyle&&(t.pixelPosition="1%"!==(e.getComputedStyle(d,null)||{}).top,t.boxSizingReliable="4px"===(e.getComputedStyle(d,null)||{width:"4px"}).width,r=d.appendChild(a.createElement("div")),r.style.cssText=d.style.cssText=s,r.style.marginRight=r.style.width="0",d.style.width="1px",t.reliableMarginRight=!parseFloat((e.getComputedStyle(r,null)||{}).marginRight)),typeof d.style.zoom!==i&&(d.innerHTML="",d.style.cssText=s+"width:1px;padding:1px;display:inline;zoom:1",t.inlineBlockNeedsLayout=3===d.offsetWidth,d.style.display="block",d.innerHTML="<div></div>",d.firstChild.style.width="5px",t.shrinkWrapBlocks=3!==d.offsetWidth,t.inlineBlockNeedsLayout&&(l.style.zoom=1)),l.removeChild(n),n=d=o=r=null)}),n=s=l=u=r=o=null,t
}({});var B=/(?:\{[\s\S]*\}|\[[\s\S]*\])$/,P=/([A-Z])/g;function R(e,n,r,i){if(x.acceptData(e)){var o,a,s=x.expando,l=e.nodeType,u=l?x.cache:e,c=l?e[s]:e[s]&&s;if(c&&u[c]&&(i||u[c].data)||r!==t||"string"!=typeof n)return c||(c=l?e[s]=p.pop()||x.guid++:s),u[c]||(u[c]=l?{}:{toJSON:x.noop}),("object"==typeof n||"function"==typeof n)&&(i?u[c]=x.extend(u[c],n):u[c].data=x.extend(u[c].data,n)),a=u[c],i||(a.data||(a.data={}),a=a.data),r!==t&&(a[x.camelCase(n)]=r),"string"==typeof n?(o=a[n],null==o&&(o=a[x.camelCase(n)])):o=a,o}}function W(e,t,n){if(x.acceptData(e)){var r,i,o=e.nodeType,a=o?x.cache:e,s=o?e[x.expando]:x.expando;if(a[s]){if(t&&(r=n?a[s]:a[s].data)){x.isArray(t)?t=t.concat(x.map(t,x.camelCase)):t in r?t=[t]:(t=x.camelCase(t),t=t in r?[t]:t.split(" ")),i=t.length;while(i--)delete r[t[i]];if(n?!I(r):!x.isEmptyObject(r))return}(n||(delete a[s].data,I(a[s])))&&(o?x.cleanData([e],!0):x.support.deleteExpando||a!=a.window?delete a[s]:a[s]=null)}}}x.extend({cache:{},noData:{applet:!0,embed:!0,object:"clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"},hasData:function(e){return e=e.nodeType?x.cache[e[x.expando]]:e[x.expando],!!e&&!I(e)},data:function(e,t,n){return R(e,t,n)},removeData:function(e,t){return W(e,t)},_data:function(e,t,n){return R(e,t,n,!0)},_removeData:function(e,t){return W(e,t,!0)},acceptData:function(e){if(e.nodeType&&1!==e.nodeType&&9!==e.nodeType)return!1;var t=e.nodeName&&x.noData[e.nodeName.toLowerCase()];return!t||t!==!0&&e.getAttribute("classid")===t}}),x.fn.extend({data:function(e,n){var r,i,o=null,a=0,s=this[0];if(e===t){if(this.length&&(o=x.data(s),1===s.nodeType&&!x._data(s,"parsedAttrs"))){for(r=s.attributes;r.length>a;a++)i=r[a].name,0===i.indexOf("data-")&&(i=x.camelCase(i.slice(5)),$(s,i,o[i]));x._data(s,"parsedAttrs",!0)}return o}return"object"==typeof e?this.each(function(){x.data(this,e)}):arguments.length>1?this.each(function(){x.data(this,e,n)}):s?$(s,e,x.data(s,e)):null},removeData:function(e){return this.each(function(){x.removeData(this,e)})}});function $(e,n,r){if(r===t&&1===e.nodeType){var i="data-"+n.replace(P,"-$1").toLowerCase();if(r=e.getAttribute(i),"string"==typeof r){try{r="true"===r?!0:"false"===r?!1:"null"===r?null:+r+""===r?+r:B.test(r)?x.parseJSON(r):r}catch(o){}x.data(e,n,r)}else r=t}return r}function I(e){var t;for(t in e)if(("data"!==t||!x.isEmptyObject(e[t]))&&"toJSON"!==t)return!1;return!0}x.extend({queue:function(e,n,r){var i;return e?(n=(n||"fx")+"queue",i=x._data(e,n),r&&(!i||x.isArray(r)?i=x._data(e,n,x.makeArray(r)):i.push(r)),i||[]):t},dequeue:function(e,t){t=t||"fx";var n=x.queue(e,t),r=n.length,i=n.shift(),o=x._queueHooks(e,t),a=function(){x.dequeue(e,t)};"inprogress"===i&&(i=n.shift(),r--),i&&("fx"===t&&n.unshift("inprogress"),delete o.stop,i.call(e,a,o)),!r&&o&&o.empty.fire()},_queueHooks:function(e,t){var n=t+"queueHooks";return x._data(e,n)||x._data(e,n,{empty:x.Callbacks("once memory").add(function(){x._removeData(e,t+"queue"),x._removeData(e,n)})})}}),x.fn.extend({queue:function(e,n){var r=2;return"string"!=typeof e&&(n=e,e="fx",r--),r>arguments.length?x.queue(this[0],e):n===t?this:this.each(function(){var t=x.queue(this,e,n);x._queueHooks(this,e),"fx"===e&&"inprogress"!==t[0]&&x.dequeue(this,e)})},dequeue:function(e){return this.each(function(){x.dequeue(this,e)})},delay:function(e,t){return e=x.fx?x.fx.speeds[e]||e:e,t=t||"fx",this.queue(t,function(t,n){var r=setTimeout(t,e);n.stop=function(){clearTimeout(r)}})},clearQueue:function(e){return this.queue(e||"fx",[])},promise:function(e,n){var r,i=1,o=x.Deferred(),a=this,s=this.length,l=function(){--i||o.resolveWith(a,[a])};"string"!=typeof e&&(n=e,e=t),e=e||"fx";while(s--)r=x._data(a[s],e+"queueHooks"),r&&r.empty&&(i++,r.empty.add(l));return l(),o.promise(n)}});var z,X,U=/[\t\r\n\f]/g,V=/\r/g,Y=/^(?:input|select|textarea|button|object)$/i,J=/^(?:a|area)$/i,G=/^(?:checked|selected)$/i,Q=x.support.getSetAttribute,K=x.support.input;x.fn.extend({attr:function(e,t){return x.access(this,x.attr,e,t,arguments.length>1)},removeAttr:function(e){return this.each(function(){x.removeAttr(this,e)})},prop:function(e,t){return x.access(this,x.prop,e,t,arguments.length>1)},removeProp:function(e){return e=x.propFix[e]||e,this.each(function(){try{this[e]=t,delete this[e]}catch(n){}})},addClass:function(e){var t,n,r,i,o,a=0,s=this.length,l="string"==typeof e&&e;if(x.isFunction(e))return this.each(function(t){x(this).addClass(e.call(this,t,this.className))});if(l)for(t=(e||"").match(T)||[];s>a;a++)if(n=this[a],r=1===n.nodeType&&(n.className?(" "+n.className+" ").replace(U," "):" ")){o=0;while(i=t[o++])0>r.indexOf(" "+i+" ")&&(r+=i+" ");n.className=x.trim(r)}return this},removeClass:function(e){var t,n,r,i,o,a=0,s=this.length,l=0===arguments.length||"string"==typeof e&&e;if(x.isFunction(e))return this.each(function(t){x(this).removeClass(e.call(this,t,this.className))});if(l)for(t=(e||"").match(T)||[];s>a;a++)if(n=this[a],r=1===n.nodeType&&(n.className?(" "+n.className+" ").replace(U," "):"")){o=0;while(i=t[o++])while(r.indexOf(" "+i+" ")>=0)r=r.replace(" "+i+" "," ");n.className=e?x.trim(r):""}return this},toggleClass:function(e,t){var n=typeof e;return"boolean"==typeof t&&"string"===n?t?this.addClass(e):this.removeClass(e):x.isFunction(e)?this.each(function(n){x(this).toggleClass(e.call(this,n,this.className,t),t)}):this.each(function(){if("string"===n){var t,r=0,o=x(this),a=e.match(T)||[];while(t=a[r++])o.hasClass(t)?o.removeClass(t):o.addClass(t)}else(n===i||"boolean"===n)&&(this.className&&x._data(this,"__className__",this.className),this.className=this.className||e===!1?"":x._data(this,"__className__")||"")})},hasClass:function(e){var t=" "+e+" ",n=0,r=this.length;for(;r>n;n++)if(1===this[n].nodeType&&(" "+this[n].className+" ").replace(U," ").indexOf(t)>=0)return!0;return!1},val:function(e){var n,r,i,o=this[0];{if(arguments.length)return i=x.isFunction(e),this.each(function(n){var o;1===this.nodeType&&(o=i?e.call(this,n,x(this).val()):e,null==o?o="":"number"==typeof o?o+="":x.isArray(o)&&(o=x.map(o,function(e){return null==e?"":e+""})),r=x.valHooks[this.type]||x.valHooks[this.nodeName.toLowerCase()],r&&"set"in r&&r.set(this,o,"value")!==t||(this.value=o))});if(o)return r=x.valHooks[o.type]||x.valHooks[o.nodeName.toLowerCase()],r&&"get"in r&&(n=r.get(o,"value"))!==t?n:(n=o.value,"string"==typeof n?n.replace(V,""):null==n?"":n)}}}),x.extend({valHooks:{option:{get:function(e){var t=x.find.attr(e,"value");return null!=t?t:e.text}},select:{get:function(e){var t,n,r=e.options,i=e.selectedIndex,o="select-one"===e.type||0>i,a=o?null:[],s=o?i+1:r.length,l=0>i?s:o?i:0;for(;s>l;l++)if(n=r[l],!(!n.selected&&l!==i||(x.support.optDisabled?n.disabled:null!==n.getAttribute("disabled"))||n.parentNode.disabled&&x.nodeName(n.parentNode,"optgroup"))){if(t=x(n).val(),o)return t;a.push(t)}return a},set:function(e,t){var n,r,i=e.options,o=x.makeArray(t),a=i.length;while(a--)r=i[a],(r.selected=x.inArray(x(r).val(),o)>=0)&&(n=!0);return n||(e.selectedIndex=-1),o}}},attr:function(e,n,r){var o,a,s=e.nodeType;if(e&&3!==s&&8!==s&&2!==s)return typeof e.getAttribute===i?x.prop(e,n,r):(1===s&&x.isXMLDoc(e)||(n=n.toLowerCase(),o=x.attrHooks[n]||(x.expr.match.bool.test(n)?X:z)),r===t?o&&"get"in o&&null!==(a=o.get(e,n))?a:(a=x.find.attr(e,n),null==a?t:a):null!==r?o&&"set"in o&&(a=o.set(e,r,n))!==t?a:(e.setAttribute(n,r+""),r):(x.removeAttr(e,n),t))},removeAttr:function(e,t){var n,r,i=0,o=t&&t.match(T);if(o&&1===e.nodeType)while(n=o[i++])r=x.propFix[n]||n,x.expr.match.bool.test(n)?K&&Q||!G.test(n)?e[r]=!1:e[x.camelCase("default-"+n)]=e[r]=!1:x.attr(e,n,""),e.removeAttribute(Q?n:r)},attrHooks:{type:{set:function(e,t){if(!x.support.radioValue&&"radio"===t&&x.nodeName(e,"input")){var n=e.value;return e.setAttribute("type",t),n&&(e.value=n),t}}}},propFix:{"for":"htmlFor","class":"className"},prop:function(e,n,r){var i,o,a,s=e.nodeType;if(e&&3!==s&&8!==s&&2!==s)return a=1!==s||!x.isXMLDoc(e),a&&(n=x.propFix[n]||n,o=x.propHooks[n]),r!==t?o&&"set"in o&&(i=o.set(e,r,n))!==t?i:e[n]=r:o&&"get"in o&&null!==(i=o.get(e,n))?i:e[n]},propHooks:{tabIndex:{get:function(e){var t=x.find.attr(e,"tabindex");return t?parseInt(t,10):Y.test(e.nodeName)||J.test(e.nodeName)&&e.href?0:-1}}}}),X={set:function(e,t,n){return t===!1?x.removeAttr(e,n):K&&Q||!G.test(n)?e.setAttribute(!Q&&x.propFix[n]||n,n):e[x.camelCase("default-"+n)]=e[n]=!0,n}},x.each(x.expr.match.bool.source.match(/\w+/g),function(e,n){var r=x.expr.attrHandle[n]||x.find.attr;x.expr.attrHandle[n]=K&&Q||!G.test(n)?function(e,n,i){var o=x.expr.attrHandle[n],a=i?t:(x.expr.attrHandle[n]=t)!=r(e,n,i)?n.toLowerCase():null;return x.expr.attrHandle[n]=o,a}:function(e,n,r){return r?t:e[x.camelCase("default-"+n)]?n.toLowerCase():null}}),K&&Q||(x.attrHooks.value={set:function(e,n,r){return x.nodeName(e,"input")?(e.defaultValue=n,t):z&&z.set(e,n,r)}}),Q||(z={set:function(e,n,r){var i=e.getAttributeNode(r);return i||e.setAttributeNode(i=e.ownerDocument.createAttribute(r)),i.value=n+="","value"===r||n===e.getAttribute(r)?n:t}},x.expr.attrHandle.id=x.expr.attrHandle.name=x.expr.attrHandle.coords=function(e,n,r){var i;return r?t:(i=e.getAttributeNode(n))&&""!==i.value?i.value:null},x.valHooks.button={get:function(e,n){var r=e.getAttributeNode(n);return r&&r.specified?r.value:t},set:z.set},x.attrHooks.contenteditable={set:function(e,t,n){z.set(e,""===t?!1:t,n)}},x.each(["width","height"],function(e,n){x.attrHooks[n]={set:function(e,r){return""===r?(e.setAttribute(n,"auto"),r):t}}})),x.support.hrefNormalized||x.each(["href","src"],function(e,t){x.propHooks[t]={get:function(e){return e.getAttribute(t,4)}}}),x.support.style||(x.attrHooks.style={get:function(e){return e.style.cssText||t},set:function(e,t){return e.style.cssText=t+""}}),x.support.optSelected||(x.propHooks.selected={get:function(e){var t=e.parentNode;return t&&(t.selectedIndex,t.parentNode&&t.parentNode.selectedIndex),null}}),x.each(["tabIndex","readOnly","maxLength","cellSpacing","cellPadding","rowSpan","colSpan","useMap","frameBorder","contentEditable"],function(){x.propFix[this.toLowerCase()]=this}),x.support.enctype||(x.propFix.enctype="encoding"),x.each(["radio","checkbox"],function(){x.valHooks[this]={set:function(e,n){return x.isArray(n)?e.checked=x.inArray(x(e).val(),n)>=0:t}},x.support.checkOn||(x.valHooks[this].get=function(e){return null===e.getAttribute("value")?"on":e.value})});var Z=/^(?:input|select|textarea)$/i,et=/^key/,tt=/^(?:mouse|contextmenu)|click/,nt=/^(?:focusinfocus|focusoutblur)$/,rt=/^([^.]*)(?:\.(.+)|)$/;function it(){return!0}function ot(){return!1}function at(){try{return a.activeElement}catch(e){}}x.event={global:{},add:function(e,n,r,o,a){var s,l,u,c,p,f,d,h,g,m,y,v=x._data(e);if(v){r.handler&&(c=r,r=c.handler,a=c.selector),r.guid||(r.guid=x.guid++),(l=v.events)||(l=v.events={}),(f=v.handle)||(f=v.handle=function(e){return typeof x===i||e&&x.event.triggered===e.type?t:x.event.dispatch.apply(f.elem,arguments)},f.elem=e),n=(n||"").match(T)||[""],u=n.length;while(u--)s=rt.exec(n[u])||[],g=y=s[1],m=(s[2]||"").split(".").sort(),g&&(p=x.event.special[g]||{},g=(a?p.delegateType:p.bindType)||g,p=x.event.special[g]||{},d=x.extend({type:g,origType:y,data:o,handler:r,guid:r.guid,selector:a,needsContext:a&&x.expr.match.needsContext.test(a),namespace:m.join(".")},c),(h=l[g])||(h=l[g]=[],h.delegateCount=0,p.setup&&p.setup.call(e,o,m,f)!==!1||(e.addEventListener?e.addEventListener(g,f,!1):e.attachEvent&&e.attachEvent("on"+g,f))),p.add&&(p.add.call(e,d),d.handler.guid||(d.handler.guid=r.guid)),a?h.splice(h.delegateCount++,0,d):h.push(d),x.event.global[g]=!0);e=null}},remove:function(e,t,n,r,i){var o,a,s,l,u,c,p,f,d,h,g,m=x.hasData(e)&&x._data(e);if(m&&(c=m.events)){t=(t||"").match(T)||[""],u=t.length;while(u--)if(s=rt.exec(t[u])||[],d=g=s[1],h=(s[2]||"").split(".").sort(),d){p=x.event.special[d]||{},d=(r?p.delegateType:p.bindType)||d,f=c[d]||[],s=s[2]&&RegExp("(^|\\.)"+h.join("\\.(?:.*\\.|)")+"(\\.|$)"),l=o=f.length;while(o--)a=f[o],!i&&g!==a.origType||n&&n.guid!==a.guid||s&&!s.test(a.namespace)||r&&r!==a.selector&&("**"!==r||!a.selector)||(f.splice(o,1),a.selector&&f.delegateCount--,p.remove&&p.remove.call(e,a));l&&!f.length&&(p.teardown&&p.teardown.call(e,h,m.handle)!==!1||x.removeEvent(e,d,m.handle),delete c[d])}else for(d in c)x.event.remove(e,d+t[u],n,r,!0);x.isEmptyObject(c)&&(delete m.handle,x._removeData(e,"events"))}},trigger:function(n,r,i,o){var s,l,u,c,p,f,d,h=[i||a],g=v.call(n,"type")?n.type:n,m=v.call(n,"namespace")?n.namespace.split("."):[];if(u=f=i=i||a,3!==i.nodeType&&8!==i.nodeType&&!nt.test(g+x.event.triggered)&&(g.indexOf(".")>=0&&(m=g.split("."),g=m.shift(),m.sort()),l=0>g.indexOf(":")&&"on"+g,n=n[x.expando]?n:new x.Event(g,"object"==typeof n&&n),n.isTrigger=o?2:3,n.namespace=m.join("."),n.namespace_re=n.namespace?RegExp("(^|\\.)"+m.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,n.result=t,n.target||(n.target=i),r=null==r?[n]:x.makeArray(r,[n]),p=x.event.special[g]||{},o||!p.trigger||p.trigger.apply(i,r)!==!1)){if(!o&&!p.noBubble&&!x.isWindow(i)){for(c=p.delegateType||g,nt.test(c+g)||(u=u.parentNode);u;u=u.parentNode)h.push(u),f=u;f===(i.ownerDocument||a)&&h.push(f.defaultView||f.parentWindow||e)}d=0;while((u=h[d++])&&!n.isPropagationStopped())n.type=d>1?c:p.bindType||g,s=(x._data(u,"events")||{})[n.type]&&x._data(u,"handle"),s&&s.apply(u,r),s=l&&u[l],s&&x.acceptData(u)&&s.apply&&s.apply(u,r)===!1&&n.preventDefault();if(n.type=g,!o&&!n.isDefaultPrevented()&&(!p._default||p._default.apply(h.pop(),r)===!1)&&x.acceptData(i)&&l&&i[g]&&!x.isWindow(i)){f=i[l],f&&(i[l]=null),x.event.triggered=g;try{i[g]()}catch(y){}x.event.triggered=t,f&&(i[l]=f)}return n.result}},dispatch:function(e){e=x.event.fix(e);var n,r,i,o,a,s=[],l=g.call(arguments),u=(x._data(this,"events")||{})[e.type]||[],c=x.event.special[e.type]||{};if(l[0]=e,e.delegateTarget=this,!c.preDispatch||c.preDispatch.call(this,e)!==!1){s=x.event.handlers.call(this,e,u),n=0;while((o=s[n++])&&!e.isPropagationStopped()){e.currentTarget=o.elem,a=0;while((i=o.handlers[a++])&&!e.isImmediatePropagationStopped())(!e.namespace_re||e.namespace_re.test(i.namespace))&&(e.handleObj=i,e.data=i.data,r=((x.event.special[i.origType]||{}).handle||i.handler).apply(o.elem,l),r!==t&&(e.result=r)===!1&&(e.preventDefault(),e.stopPropagation()))}return c.postDispatch&&c.postDispatch.call(this,e),e.result}},handlers:function(e,n){var r,i,o,a,s=[],l=n.delegateCount,u=e.target;if(l&&u.nodeType&&(!e.button||"click"!==e.type))for(;u!=this;u=u.parentNode||this)if(1===u.nodeType&&(u.disabled!==!0||"click"!==e.type)){for(o=[],a=0;l>a;a++)i=n[a],r=i.selector+" ",o[r]===t&&(o[r]=i.needsContext?x(r,this).index(u)>=0:x.find(r,this,null,[u]).length),o[r]&&o.push(i);o.length&&s.push({elem:u,handlers:o})}return n.length>l&&s.push({elem:this,handlers:n.slice(l)}),s},fix:function(e){if(e[x.expando])return e;var t,n,r,i=e.type,o=e,s=this.fixHooks[i];s||(this.fixHooks[i]=s=tt.test(i)?this.mouseHooks:et.test(i)?this.keyHooks:{}),r=s.props?this.props.concat(s.props):this.props,e=new x.Event(o),t=r.length;while(t--)n=r[t],e[n]=o[n];return e.target||(e.target=o.srcElement||a),3===e.target.nodeType&&(e.target=e.target.parentNode),e.metaKey=!!e.metaKey,s.filter?s.filter(e,o):e},props:"altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),fixHooks:{},keyHooks:{props:"char charCode key keyCode".split(" "),filter:function(e,t){return null==e.which&&(e.which=null!=t.charCode?t.charCode:t.keyCode),e}},mouseHooks:{props:"button buttons clientX clientY fromElement offsetX offsetY pageX pageY screenX screenY toElement".split(" "),filter:function(e,n){var r,i,o,s=n.button,l=n.fromElement;return null==e.pageX&&null!=n.clientX&&(i=e.target.ownerDocument||a,o=i.documentElement,r=i.body,e.pageX=n.clientX+(o&&o.scrollLeft||r&&r.scrollLeft||0)-(o&&o.clientLeft||r&&r.clientLeft||0),e.pageY=n.clientY+(o&&o.scrollTop||r&&r.scrollTop||0)-(o&&o.clientTop||r&&r.clientTop||0)),!e.relatedTarget&&l&&(e.relatedTarget=l===e.target?n.toElement:l),e.which||s===t||(e.which=1&s?1:2&s?3:4&s?2:0),e}},special:{load:{noBubble:!0},focus:{trigger:function(){if(this!==at()&&this.focus)try{return this.focus(),!1}catch(e){}},delegateType:"focusin"},blur:{trigger:function(){return this===at()&&this.blur?(this.blur(),!1):t},delegateType:"focusout"},click:{trigger:function(){return x.nodeName(this,"input")&&"checkbox"===this.type&&this.click?(this.click(),!1):t},_default:function(e){return x.nodeName(e.target,"a")}},beforeunload:{postDispatch:function(e){e.result!==t&&(e.originalEvent.returnValue=e.result)}}},simulate:function(e,t,n,r){var i=x.extend(new x.Event,n,{type:e,isSimulated:!0,originalEvent:{}});r?x.event.trigger(i,null,t):x.event.dispatch.call(t,i),i.isDefaultPrevented()&&n.preventDefault()}},x.removeEvent=a.removeEventListener?function(e,t,n){e.removeEventListener&&e.removeEventListener(t,n,!1)}:function(e,t,n){var r="on"+t;e.detachEvent&&(typeof e[r]===i&&(e[r]=null),e.detachEvent(r,n))},x.Event=function(e,n){return this instanceof x.Event?(e&&e.type?(this.originalEvent=e,this.type=e.type,this.isDefaultPrevented=e.defaultPrevented||e.returnValue===!1||e.getPreventDefault&&e.getPreventDefault()?it:ot):this.type=e,n&&x.extend(this,n),this.timeStamp=e&&e.timeStamp||x.now(),this[x.expando]=!0,t):new x.Event(e,n)},x.Event.prototype={isDefaultPrevented:ot,isPropagationStopped:ot,isImmediatePropagationStopped:ot,preventDefault:function(){var e=this.originalEvent;this.isDefaultPrevented=it,e&&(e.preventDefault?e.preventDefault():e.returnValue=!1)},stopPropagation:function(){var e=this.originalEvent;this.isPropagationStopped=it,e&&(e.stopPropagation&&e.stopPropagation(),e.cancelBubble=!0)},stopImmediatePropagation:function(){this.isImmediatePropagationStopped=it,this.stopPropagation()}},x.each({mouseenter:"mouseover",mouseleave:"mouseout"},function(e,t){x.event.special[e]={delegateType:t,bindType:t,handle:function(e){var n,r=this,i=e.relatedTarget,o=e.handleObj;return(!i||i!==r&&!x.contains(r,i))&&(e.type=o.origType,n=o.handler.apply(this,arguments),e.type=t),n}}}),x.support.submitBubbles||(x.event.special.submit={setup:function(){return x.nodeName(this,"form")?!1:(x.event.add(this,"click._submit keypress._submit",function(e){var n=e.target,r=x.nodeName(n,"input")||x.nodeName(n,"button")?n.form:t;r&&!x._data(r,"submitBubbles")&&(x.event.add(r,"submit._submit",function(e){e._submit_bubble=!0}),x._data(r,"submitBubbles",!0))}),t)},postDispatch:function(e){e._submit_bubble&&(delete e._submit_bubble,this.parentNode&&!e.isTrigger&&x.event.simulate("submit",this.parentNode,e,!0))},teardown:function(){return x.nodeName(this,"form")?!1:(x.event.remove(this,"._submit"),t)}}),x.support.changeBubbles||(x.event.special.change={setup:function(){return Z.test(this.nodeName)?(("checkbox"===this.type||"radio"===this.type)&&(x.event.add(this,"propertychange._change",function(e){"checked"===e.originalEvent.propertyName&&(this._just_changed=!0)}),x.event.add(this,"click._change",function(e){this._just_changed&&!e.isTrigger&&(this._just_changed=!1),x.event.simulate("change",this,e,!0)})),!1):(x.event.add(this,"beforeactivate._change",function(e){var t=e.target;Z.test(t.nodeName)&&!x._data(t,"changeBubbles")&&(x.event.add(t,"change._change",function(e){!this.parentNode||e.isSimulated||e.isTrigger||x.event.simulate("change",this.parentNode,e,!0)}),x._data(t,"changeBubbles",!0))}),t)},handle:function(e){var n=e.target;return this!==n||e.isSimulated||e.isTrigger||"radio"!==n.type&&"checkbox"!==n.type?e.handleObj.handler.apply(this,arguments):t},teardown:function(){return x.event.remove(this,"._change"),!Z.test(this.nodeName)}}),x.support.focusinBubbles||x.each({focus:"focusin",blur:"focusout"},function(e,t){var n=0,r=function(e){x.event.simulate(t,e.target,x.event.fix(e),!0)};x.event.special[t]={setup:function(){0===n++&&a.addEventListener(e,r,!0)},teardown:function(){0===--n&&a.removeEventListener(e,r,!0)}}}),x.fn.extend({on:function(e,n,r,i,o){var a,s;if("object"==typeof e){"string"!=typeof n&&(r=r||n,n=t);for(a in e)this.on(a,n,r,e[a],o);return this}if(null==r&&null==i?(i=n,r=n=t):null==i&&("string"==typeof n?(i=r,r=t):(i=r,r=n,n=t)),i===!1)i=ot;else if(!i)return this;return 1===o&&(s=i,i=function(e){return x().off(e),s.apply(this,arguments)},i.guid=s.guid||(s.guid=x.guid++)),this.each(function(){x.event.add(this,e,i,r,n)})},one:function(e,t,n,r){return this.on(e,t,n,r,1)},off:function(e,n,r){var i,o;if(e&&e.preventDefault&&e.handleObj)return i=e.handleObj,x(e.delegateTarget).off(i.namespace?i.origType+"."+i.namespace:i.origType,i.selector,i.handler),this;if("object"==typeof e){for(o in e)this.off(o,n,e[o]);return this}return(n===!1||"function"==typeof n)&&(r=n,n=t),r===!1&&(r=ot),this.each(function(){x.event.remove(this,e,r,n)})},trigger:function(e,t){return this.each(function(){x.event.trigger(e,t,this)})},triggerHandler:function(e,n){var r=this[0];return r?x.event.trigger(e,n,r,!0):t}});var st=/^.[^:#\[\.,]*$/,lt=/^(?:parents|prev(?:Until|All))/,ut=x.expr.match.needsContext,ct={children:!0,contents:!0,next:!0,prev:!0};x.fn.extend({find:function(e){var t,n=[],r=this,i=r.length;if("string"!=typeof e)return this.pushStack(x(e).filter(function(){for(t=0;i>t;t++)if(x.contains(r[t],this))return!0}));for(t=0;i>t;t++)x.find(e,r[t],n);return n=this.pushStack(i>1?x.unique(n):n),n.selector=this.selector?this.selector+" "+e:e,n},has:function(e){var t,n=x(e,this),r=n.length;return this.filter(function(){for(t=0;r>t;t++)if(x.contains(this,n[t]))return!0})},not:function(e){return this.pushStack(ft(this,e||[],!0))},filter:function(e){return this.pushStack(ft(this,e||[],!1))},is:function(e){return!!ft(this,"string"==typeof e&&ut.test(e)?x(e):e||[],!1).length},closest:function(e,t){var n,r=0,i=this.length,o=[],a=ut.test(e)||"string"!=typeof e?x(e,t||this.context):0;for(;i>r;r++)for(n=this[r];n&&n!==t;n=n.parentNode)if(11>n.nodeType&&(a?a.index(n)>-1:1===n.nodeType&&x.find.matchesSelector(n,e))){n=o.push(n);break}return this.pushStack(o.length>1?x.unique(o):o)},index:function(e){return e?"string"==typeof e?x.inArray(this[0],x(e)):x.inArray(e.jquery?e[0]:e,this):this[0]&&this[0].parentNode?this.first().prevAll().length:-1},add:function(e,t){var n="string"==typeof e?x(e,t):x.makeArray(e&&e.nodeType?[e]:e),r=x.merge(this.get(),n);return this.pushStack(x.unique(r))},addBack:function(e){return this.add(null==e?this.prevObject:this.prevObject.filter(e))}});function pt(e,t){do e=e[t];while(e&&1!==e.nodeType);return e}x.each({parent:function(e){var t=e.parentNode;return t&&11!==t.nodeType?t:null},parents:function(e){return x.dir(e,"parentNode")},parentsUntil:function(e,t,n){return x.dir(e,"parentNode",n)},next:function(e){return pt(e,"nextSibling")},prev:function(e){return pt(e,"previousSibling")},nextAll:function(e){return x.dir(e,"nextSibling")},prevAll:function(e){return x.dir(e,"previousSibling")},nextUntil:function(e,t,n){return x.dir(e,"nextSibling",n)},prevUntil:function(e,t,n){return x.dir(e,"previousSibling",n)},siblings:function(e){return x.sibling((e.parentNode||{}).firstChild,e)},children:function(e){return x.sibling(e.firstChild)},contents:function(e){return x.nodeName(e,"iframe")?e.contentDocument||e.contentWindow.document:x.merge([],e.childNodes)}},function(e,t){x.fn[e]=function(n,r){var i=x.map(this,t,n);return"Until"!==e.slice(-5)&&(r=n),r&&"string"==typeof r&&(i=x.filter(r,i)),this.length>1&&(ct[e]||(i=x.unique(i)),lt.test(e)&&(i=i.reverse())),this.pushStack(i)}}),x.extend({filter:function(e,t,n){var r=t[0];return n&&(e=":not("+e+")"),1===t.length&&1===r.nodeType?x.find.matchesSelector(r,e)?[r]:[]:x.find.matches(e,x.grep(t,function(e){return 1===e.nodeType}))},dir:function(e,n,r){var i=[],o=e[n];while(o&&9!==o.nodeType&&(r===t||1!==o.nodeType||!x(o).is(r)))1===o.nodeType&&i.push(o),o=o[n];return i},sibling:function(e,t){var n=[];for(;e;e=e.nextSibling)1===e.nodeType&&e!==t&&n.push(e);return n}});function ft(e,t,n){if(x.isFunction(t))return x.grep(e,function(e,r){return!!t.call(e,r,e)!==n});if(t.nodeType)return x.grep(e,function(e){return e===t!==n});if("string"==typeof t){if(st.test(t))return x.filter(t,e,n);t=x.filter(t,e)}return x.grep(e,function(e){return x.inArray(e,t)>=0!==n})}function dt(e){var t=ht.split("|"),n=e.createDocumentFragment();if(n.createElement)while(t.length)n.createElement(t.pop());return n}var ht="abbr|article|aside|audio|bdi|canvas|data|datalist|details|figcaption|figure|footer|header|hgroup|mark|meter|nav|output|progress|section|summary|time|video",gt=/ jQuery\d+="(?:null|\d+)"/g,mt=RegExp("<(?:"+ht+")[\\s/>]","i"),yt=/^\s+/,vt=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,bt=/<([\w:]+)/,xt=/<tbody/i,wt=/<|&#?\w+;/,Tt=/<(?:script|style|link)/i,Ct=/^(?:checkbox|radio)$/i,Nt=/checked\s*(?:[^=]|=\s*.checked.)/i,kt=/^$|\/(?:java|ecma)script/i,Et=/^true\/(.*)/,St=/^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,At={option:[1,"<select multiple='multiple'>","</select>"],legend:[1,"<fieldset>","</fieldset>"],area:[1,"<map>","</map>"],param:[1,"<object>","</object>"],thead:[1,"<table>","</table>"],tr:[2,"<table><tbody>","</tbody></table>"],col:[2,"<table><tbody></tbody><colgroup>","</colgroup></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],_default:x.support.htmlSerialize?[0,"",""]:[1,"X<div>","</div>"]},jt=dt(a),Dt=jt.appendChild(a.createElement("div"));At.optgroup=At.option,At.tbody=At.tfoot=At.colgroup=At.caption=At.thead,At.th=At.td,x.fn.extend({text:function(e){return x.access(this,function(e){return e===t?x.text(this):this.empty().append((this[0]&&this[0].ownerDocument||a).createTextNode(e))},null,e,arguments.length)},append:function(){return this.domManip(arguments,function(e){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var t=Lt(this,e);t.appendChild(e)}})},prepend:function(){return this.domManip(arguments,function(e){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var t=Lt(this,e);t.insertBefore(e,t.firstChild)}})},before:function(){return this.domManip(arguments,function(e){this.parentNode&&this.parentNode.insertBefore(e,this)})},after:function(){return this.domManip(arguments,function(e){this.parentNode&&this.parentNode.insertBefore(e,this.nextSibling)})},remove:function(e,t){var n,r=e?x.filter(e,this):this,i=0;for(;null!=(n=r[i]);i++)t||1!==n.nodeType||x.cleanData(Ft(n)),n.parentNode&&(t&&x.contains(n.ownerDocument,n)&&_t(Ft(n,"script")),n.parentNode.removeChild(n));return this},empty:function(){var e,t=0;for(;null!=(e=this[t]);t++){1===e.nodeType&&x.cleanData(Ft(e,!1));while(e.firstChild)e.removeChild(e.firstChild);e.options&&x.nodeName(e,"select")&&(e.options.length=0)}return this},clone:function(e,t){return e=null==e?!1:e,t=null==t?e:t,this.map(function(){return x.clone(this,e,t)})},html:function(e){return x.access(this,function(e){var n=this[0]||{},r=0,i=this.length;if(e===t)return 1===n.nodeType?n.innerHTML.replace(gt,""):t;if(!("string"!=typeof e||Tt.test(e)||!x.support.htmlSerialize&&mt.test(e)||!x.support.leadingWhitespace&&yt.test(e)||At[(bt.exec(e)||["",""])[1].toLowerCase()])){e=e.replace(vt,"<$1></$2>");try{for(;i>r;r++)n=this[r]||{},1===n.nodeType&&(x.cleanData(Ft(n,!1)),n.innerHTML=e);n=0}catch(o){}}n&&this.empty().append(e)},null,e,arguments.length)},replaceWith:function(){var e=x.map(this,function(e){return[e.nextSibling,e.parentNode]}),t=0;return this.domManip(arguments,function(n){var r=e[t++],i=e[t++];i&&(r&&r.parentNode!==i&&(r=this.nextSibling),x(this).remove(),i.insertBefore(n,r))},!0),t?this:this.remove()},detach:function(e){return this.remove(e,!0)},domManip:function(e,t,n){e=d.apply([],e);var r,i,o,a,s,l,u=0,c=this.length,p=this,f=c-1,h=e[0],g=x.isFunction(h);if(g||!(1>=c||"string"!=typeof h||x.support.checkClone)&&Nt.test(h))return this.each(function(r){var i=p.eq(r);g&&(e[0]=h.call(this,r,i.html())),i.domManip(e,t,n)});if(c&&(l=x.buildFragment(e,this[0].ownerDocument,!1,!n&&this),r=l.firstChild,1===l.childNodes.length&&(l=r),r)){for(a=x.map(Ft(l,"script"),Ht),o=a.length;c>u;u++)i=l,u!==f&&(i=x.clone(i,!0,!0),o&&x.merge(a,Ft(i,"script"))),t.call(this[u],i,u);if(o)for(s=a[a.length-1].ownerDocument,x.map(a,qt),u=0;o>u;u++)i=a[u],kt.test(i.type||"")&&!x._data(i,"globalEval")&&x.contains(s,i)&&(i.src?x._evalUrl(i.src):x.globalEval((i.text||i.textContent||i.innerHTML||"").replace(St,"")));l=r=null}return this}});function Lt(e,t){return x.nodeName(e,"table")&&x.nodeName(1===t.nodeType?t:t.firstChild,"tr")?e.getElementsByTagName("tbody")[0]||e.appendChild(e.ownerDocument.createElement("tbody")):e}function Ht(e){return e.type=(null!==x.find.attr(e,"type"))+"/"+e.type,e}function qt(e){var t=Et.exec(e.type);return t?e.type=t[1]:e.removeAttribute("type"),e}function _t(e,t){var n,r=0;for(;null!=(n=e[r]);r++)x._data(n,"globalEval",!t||x._data(t[r],"globalEval"))}function Mt(e,t){if(1===t.nodeType&&x.hasData(e)){var n,r,i,o=x._data(e),a=x._data(t,o),s=o.events;if(s){delete a.handle,a.events={};for(n in s)for(r=0,i=s[n].length;i>r;r++)x.event.add(t,n,s[n][r])}a.data&&(a.data=x.extend({},a.data))}}function Ot(e,t){var n,r,i;if(1===t.nodeType){if(n=t.nodeName.toLowerCase(),!x.support.noCloneEvent&&t[x.expando]){i=x._data(t);for(r in i.events)x.removeEvent(t,r,i.handle);t.removeAttribute(x.expando)}"script"===n&&t.text!==e.text?(Ht(t).text=e.text,qt(t)):"object"===n?(t.parentNode&&(t.outerHTML=e.outerHTML),x.support.html5Clone&&e.innerHTML&&!x.trim(t.innerHTML)&&(t.innerHTML=e.innerHTML)):"input"===n&&Ct.test(e.type)?(t.defaultChecked=t.checked=e.checked,t.value!==e.value&&(t.value=e.value)):"option"===n?t.defaultSelected=t.selected=e.defaultSelected:("input"===n||"textarea"===n)&&(t.defaultValue=e.defaultValue)}}x.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(e,t){x.fn[e]=function(e){var n,r=0,i=[],o=x(e),a=o.length-1;for(;a>=r;r++)n=r===a?this:this.clone(!0),x(o[r])[t](n),h.apply(i,n.get());return this.pushStack(i)}});function Ft(e,n){var r,o,a=0,s=typeof e.getElementsByTagName!==i?e.getElementsByTagName(n||"*"):typeof e.querySelectorAll!==i?e.querySelectorAll(n||"*"):t;if(!s)for(s=[],r=e.childNodes||e;null!=(o=r[a]);a++)!n||x.nodeName(o,n)?s.push(o):x.merge(s,Ft(o,n));return n===t||n&&x.nodeName(e,n)?x.merge([e],s):s}function Bt(e){Ct.test(e.type)&&(e.defaultChecked=e.checked)}x.extend({clone:function(e,t,n){var r,i,o,a,s,l=x.contains(e.ownerDocument,e);if(x.support.html5Clone||x.isXMLDoc(e)||!mt.test("<"+e.nodeName+">")?o=e.cloneNode(!0):(Dt.innerHTML=e.outerHTML,Dt.removeChild(o=Dt.firstChild)),!(x.support.noCloneEvent&&x.support.noCloneChecked||1!==e.nodeType&&11!==e.nodeType||x.isXMLDoc(e)))for(r=Ft(o),s=Ft(e),a=0;null!=(i=s[a]);++a)r[a]&&Ot(i,r[a]);if(t)if(n)for(s=s||Ft(e),r=r||Ft(o),a=0;null!=(i=s[a]);a++)Mt(i,r[a]);else Mt(e,o);return r=Ft(o,"script"),r.length>0&&_t(r,!l&&Ft(e,"script")),r=s=i=null,o},buildFragment:function(e,t,n,r){var i,o,a,s,l,u,c,p=e.length,f=dt(t),d=[],h=0;for(;p>h;h++)if(o=e[h],o||0===o)if("object"===x.type(o))x.merge(d,o.nodeType?[o]:o);else if(wt.test(o)){s=s||f.appendChild(t.createElement("div")),l=(bt.exec(o)||["",""])[1].toLowerCase(),c=At[l]||At._default,s.innerHTML=c[1]+o.replace(vt,"<$1></$2>")+c[2],i=c[0];while(i--)s=s.lastChild;if(!x.support.leadingWhitespace&&yt.test(o)&&d.push(t.createTextNode(yt.exec(o)[0])),!x.support.tbody){o="table"!==l||xt.test(o)?"<table>"!==c[1]||xt.test(o)?0:s:s.firstChild,i=o&&o.childNodes.length;while(i--)x.nodeName(u=o.childNodes[i],"tbody")&&!u.childNodes.length&&o.removeChild(u)}x.merge(d,s.childNodes),s.textContent="";while(s.firstChild)s.removeChild(s.firstChild);s=f.lastChild}else d.push(t.createTextNode(o));s&&f.removeChild(s),x.support.appendChecked||x.grep(Ft(d,"input"),Bt),h=0;while(o=d[h++])if((!r||-1===x.inArray(o,r))&&(a=x.contains(o.ownerDocument,o),s=Ft(f.appendChild(o),"script"),a&&_t(s),n)){i=0;while(o=s[i++])kt.test(o.type||"")&&n.push(o)}return s=null,f},cleanData:function(e,t){var n,r,o,a,s=0,l=x.expando,u=x.cache,c=x.support.deleteExpando,f=x.event.special;for(;null!=(n=e[s]);s++)if((t||x.acceptData(n))&&(o=n[l],a=o&&u[o])){if(a.events)for(r in a.events)f[r]?x.event.remove(n,r):x.removeEvent(n,r,a.handle);
u[o]&&(delete u[o],c?delete n[l]:typeof n.removeAttribute!==i?n.removeAttribute(l):n[l]=null,p.push(o))}},_evalUrl:function(e){return x.ajax({url:e,type:"GET",dataType:"script",async:!1,global:!1,"throws":!0})}}),x.fn.extend({wrapAll:function(e){if(x.isFunction(e))return this.each(function(t){x(this).wrapAll(e.call(this,t))});if(this[0]){var t=x(e,this[0].ownerDocument).eq(0).clone(!0);this[0].parentNode&&t.insertBefore(this[0]),t.map(function(){var e=this;while(e.firstChild&&1===e.firstChild.nodeType)e=e.firstChild;return e}).append(this)}return this},wrapInner:function(e){return x.isFunction(e)?this.each(function(t){x(this).wrapInner(e.call(this,t))}):this.each(function(){var t=x(this),n=t.contents();n.length?n.wrapAll(e):t.append(e)})},wrap:function(e){var t=x.isFunction(e);return this.each(function(n){x(this).wrapAll(t?e.call(this,n):e)})},unwrap:function(){return this.parent().each(function(){x.nodeName(this,"body")||x(this).replaceWith(this.childNodes)}).end()}});var Pt,Rt,Wt,$t=/alpha\([^)]*\)/i,It=/opacity\s*=\s*([^)]*)/,zt=/^(top|right|bottom|left)$/,Xt=/^(none|table(?!-c[ea]).+)/,Ut=/^margin/,Vt=RegExp("^("+w+")(.*)$","i"),Yt=RegExp("^("+w+")(?!px)[a-z%]+$","i"),Jt=RegExp("^([+-])=("+w+")","i"),Gt={BODY:"block"},Qt={position:"absolute",visibility:"hidden",display:"block"},Kt={letterSpacing:0,fontWeight:400},Zt=["Top","Right","Bottom","Left"],en=["Webkit","O","Moz","ms"];function tn(e,t){if(t in e)return t;var n=t.charAt(0).toUpperCase()+t.slice(1),r=t,i=en.length;while(i--)if(t=en[i]+n,t in e)return t;return r}function nn(e,t){return e=t||e,"none"===x.css(e,"display")||!x.contains(e.ownerDocument,e)}function rn(e,t){var n,r,i,o=[],a=0,s=e.length;for(;s>a;a++)r=e[a],r.style&&(o[a]=x._data(r,"olddisplay"),n=r.style.display,t?(o[a]||"none"!==n||(r.style.display=""),""===r.style.display&&nn(r)&&(o[a]=x._data(r,"olddisplay",ln(r.nodeName)))):o[a]||(i=nn(r),(n&&"none"!==n||!i)&&x._data(r,"olddisplay",i?n:x.css(r,"display"))));for(a=0;s>a;a++)r=e[a],r.style&&(t&&"none"!==r.style.display&&""!==r.style.display||(r.style.display=t?o[a]||"":"none"));return e}x.fn.extend({css:function(e,n){return x.access(this,function(e,n,r){var i,o,a={},s=0;if(x.isArray(n)){for(o=Rt(e),i=n.length;i>s;s++)a[n[s]]=x.css(e,n[s],!1,o);return a}return r!==t?x.style(e,n,r):x.css(e,n)},e,n,arguments.length>1)},show:function(){return rn(this,!0)},hide:function(){return rn(this)},toggle:function(e){return"boolean"==typeof e?e?this.show():this.hide():this.each(function(){nn(this)?x(this).show():x(this).hide()})}}),x.extend({cssHooks:{opacity:{get:function(e,t){if(t){var n=Wt(e,"opacity");return""===n?"1":n}}}},cssNumber:{columnCount:!0,fillOpacity:!0,fontWeight:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{"float":x.support.cssFloat?"cssFloat":"styleFloat"},style:function(e,n,r,i){if(e&&3!==e.nodeType&&8!==e.nodeType&&e.style){var o,a,s,l=x.camelCase(n),u=e.style;if(n=x.cssProps[l]||(x.cssProps[l]=tn(u,l)),s=x.cssHooks[n]||x.cssHooks[l],r===t)return s&&"get"in s&&(o=s.get(e,!1,i))!==t?o:u[n];if(a=typeof r,"string"===a&&(o=Jt.exec(r))&&(r=(o[1]+1)*o[2]+parseFloat(x.css(e,n)),a="number"),!(null==r||"number"===a&&isNaN(r)||("number"!==a||x.cssNumber[l]||(r+="px"),x.support.clearCloneStyle||""!==r||0!==n.indexOf("background")||(u[n]="inherit"),s&&"set"in s&&(r=s.set(e,r,i))===t)))try{u[n]=r}catch(c){}}},css:function(e,n,r,i){var o,a,s,l=x.camelCase(n);return n=x.cssProps[l]||(x.cssProps[l]=tn(e.style,l)),s=x.cssHooks[n]||x.cssHooks[l],s&&"get"in s&&(a=s.get(e,!0,r)),a===t&&(a=Wt(e,n,i)),"normal"===a&&n in Kt&&(a=Kt[n]),""===r||r?(o=parseFloat(a),r===!0||x.isNumeric(o)?o||0:a):a}}),e.getComputedStyle?(Rt=function(t){return e.getComputedStyle(t,null)},Wt=function(e,n,r){var i,o,a,s=r||Rt(e),l=s?s.getPropertyValue(n)||s[n]:t,u=e.style;return s&&(""!==l||x.contains(e.ownerDocument,e)||(l=x.style(e,n)),Yt.test(l)&&Ut.test(n)&&(i=u.width,o=u.minWidth,a=u.maxWidth,u.minWidth=u.maxWidth=u.width=l,l=s.width,u.width=i,u.minWidth=o,u.maxWidth=a)),l}):a.documentElement.currentStyle&&(Rt=function(e){return e.currentStyle},Wt=function(e,n,r){var i,o,a,s=r||Rt(e),l=s?s[n]:t,u=e.style;return null==l&&u&&u[n]&&(l=u[n]),Yt.test(l)&&!zt.test(n)&&(i=u.left,o=e.runtimeStyle,a=o&&o.left,a&&(o.left=e.currentStyle.left),u.left="fontSize"===n?"1em":l,l=u.pixelLeft+"px",u.left=i,a&&(o.left=a)),""===l?"auto":l});function on(e,t,n){var r=Vt.exec(t);return r?Math.max(0,r[1]-(n||0))+(r[2]||"px"):t}function an(e,t,n,r,i){var o=n===(r?"border":"content")?4:"width"===t?1:0,a=0;for(;4>o;o+=2)"margin"===n&&(a+=x.css(e,n+Zt[o],!0,i)),r?("content"===n&&(a-=x.css(e,"padding"+Zt[o],!0,i)),"margin"!==n&&(a-=x.css(e,"border"+Zt[o]+"Width",!0,i))):(a+=x.css(e,"padding"+Zt[o],!0,i),"padding"!==n&&(a+=x.css(e,"border"+Zt[o]+"Width",!0,i)));return a}function sn(e,t,n){var r=!0,i="width"===t?e.offsetWidth:e.offsetHeight,o=Rt(e),a=x.support.boxSizing&&"border-box"===x.css(e,"boxSizing",!1,o);if(0>=i||null==i){if(i=Wt(e,t,o),(0>i||null==i)&&(i=e.style[t]),Yt.test(i))return i;r=a&&(x.support.boxSizingReliable||i===e.style[t]),i=parseFloat(i)||0}return i+an(e,t,n||(a?"border":"content"),r,o)+"px"}function ln(e){var t=a,n=Gt[e];return n||(n=un(e,t),"none"!==n&&n||(Pt=(Pt||x("<iframe frameborder='0' width='0' height='0'/>").css("cssText","display:block !important")).appendTo(t.documentElement),t=(Pt[0].contentWindow||Pt[0].contentDocument).document,t.write("<!doctype html><html><body>"),t.close(),n=un(e,t),Pt.detach()),Gt[e]=n),n}function un(e,t){var n=x(t.createElement(e)).appendTo(t.body),r=x.css(n[0],"display");return n.remove(),r}x.each(["height","width"],function(e,n){x.cssHooks[n]={get:function(e,r,i){return r?0===e.offsetWidth&&Xt.test(x.css(e,"display"))?x.swap(e,Qt,function(){return sn(e,n,i)}):sn(e,n,i):t},set:function(e,t,r){var i=r&&Rt(e);return on(e,t,r?an(e,n,r,x.support.boxSizing&&"border-box"===x.css(e,"boxSizing",!1,i),i):0)}}}),x.support.opacity||(x.cssHooks.opacity={get:function(e,t){return It.test((t&&e.currentStyle?e.currentStyle.filter:e.style.filter)||"")?.01*parseFloat(RegExp.$1)+"":t?"1":""},set:function(e,t){var n=e.style,r=e.currentStyle,i=x.isNumeric(t)?"alpha(opacity="+100*t+")":"",o=r&&r.filter||n.filter||"";n.zoom=1,(t>=1||""===t)&&""===x.trim(o.replace($t,""))&&n.removeAttribute&&(n.removeAttribute("filter"),""===t||r&&!r.filter)||(n.filter=$t.test(o)?o.replace($t,i):o+" "+i)}}),x(function(){x.support.reliableMarginRight||(x.cssHooks.marginRight={get:function(e,n){return n?x.swap(e,{display:"inline-block"},Wt,[e,"marginRight"]):t}}),!x.support.pixelPosition&&x.fn.position&&x.each(["top","left"],function(e,n){x.cssHooks[n]={get:function(e,r){return r?(r=Wt(e,n),Yt.test(r)?x(e).position()[n]+"px":r):t}}})}),x.expr&&x.expr.filters&&(x.expr.filters.hidden=function(e){return 0>=e.offsetWidth&&0>=e.offsetHeight||!x.support.reliableHiddenOffsets&&"none"===(e.style&&e.style.display||x.css(e,"display"))},x.expr.filters.visible=function(e){return!x.expr.filters.hidden(e)}),x.each({margin:"",padding:"",border:"Width"},function(e,t){x.cssHooks[e+t]={expand:function(n){var r=0,i={},o="string"==typeof n?n.split(" "):[n];for(;4>r;r++)i[e+Zt[r]+t]=o[r]||o[r-2]||o[0];return i}},Ut.test(e)||(x.cssHooks[e+t].set=on)});var cn=/%20/g,pn=/\[\]$/,fn=/\r?\n/g,dn=/^(?:submit|button|image|reset|file)$/i,hn=/^(?:input|select|textarea|keygen)/i;x.fn.extend({serialize:function(){return x.param(this.serializeArray())},serializeArray:function(){return this.map(function(){var e=x.prop(this,"elements");return e?x.makeArray(e):this}).filter(function(){var e=this.type;return this.name&&!x(this).is(":disabled")&&hn.test(this.nodeName)&&!dn.test(e)&&(this.checked||!Ct.test(e))}).map(function(e,t){var n=x(this).val();return null==n?null:x.isArray(n)?x.map(n,function(e){return{name:t.name,value:e.replace(fn,"\r\n")}}):{name:t.name,value:n.replace(fn,"\r\n")}}).get()}}),x.param=function(e,n){var r,i=[],o=function(e,t){t=x.isFunction(t)?t():null==t?"":t,i[i.length]=encodeURIComponent(e)+"="+encodeURIComponent(t)};if(n===t&&(n=x.ajaxSettings&&x.ajaxSettings.traditional),x.isArray(e)||e.jquery&&!x.isPlainObject(e))x.each(e,function(){o(this.name,this.value)});else for(r in e)gn(r,e[r],n,o);return i.join("&").replace(cn,"+")};function gn(e,t,n,r){var i;if(x.isArray(t))x.each(t,function(t,i){n||pn.test(e)?r(e,i):gn(e+"["+("object"==typeof i?t:"")+"]",i,n,r)});else if(n||"object"!==x.type(t))r(e,t);else for(i in t)gn(e+"["+i+"]",t[i],n,r)}x.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "),function(e,t){x.fn[t]=function(e,n){return arguments.length>0?this.on(t,null,e,n):this.trigger(t)}}),x.fn.extend({hover:function(e,t){return this.mouseenter(e).mouseleave(t||e)},bind:function(e,t,n){return this.on(e,null,t,n)},unbind:function(e,t){return this.off(e,null,t)},delegate:function(e,t,n,r){return this.on(t,e,n,r)},undelegate:function(e,t,n){return 1===arguments.length?this.off(e,"**"):this.off(t,e||"**",n)}});var mn,yn,vn=x.now(),bn=/\?/,xn=/#.*$/,wn=/([?&])_=[^&]*/,Tn=/^(.*?):[ \t]*([^\r\n]*)\r?$/gm,Cn=/^(?:about|app|app-storage|.+-extension|file|res|widget):$/,Nn=/^(?:GET|HEAD)$/,kn=/^\/\//,En=/^([\w.+-]+:)(?:\/\/([^\/?#:]*)(?::(\d+)|)|)/,Sn=x.fn.load,An={},jn={},Dn="*/".concat("*");try{yn=o.href}catch(Ln){yn=a.createElement("a"),yn.href="",yn=yn.href}mn=En.exec(yn.toLowerCase())||[];function Hn(e){return function(t,n){"string"!=typeof t&&(n=t,t="*");var r,i=0,o=t.toLowerCase().match(T)||[];if(x.isFunction(n))while(r=o[i++])"+"===r[0]?(r=r.slice(1)||"*",(e[r]=e[r]||[]).unshift(n)):(e[r]=e[r]||[]).push(n)}}function qn(e,n,r,i){var o={},a=e===jn;function s(l){var u;return o[l]=!0,x.each(e[l]||[],function(e,l){var c=l(n,r,i);return"string"!=typeof c||a||o[c]?a?!(u=c):t:(n.dataTypes.unshift(c),s(c),!1)}),u}return s(n.dataTypes[0])||!o["*"]&&s("*")}function _n(e,n){var r,i,o=x.ajaxSettings.flatOptions||{};for(i in n)n[i]!==t&&((o[i]?e:r||(r={}))[i]=n[i]);return r&&x.extend(!0,e,r),e}x.fn.load=function(e,n,r){if("string"!=typeof e&&Sn)return Sn.apply(this,arguments);var i,o,a,s=this,l=e.indexOf(" ");return l>=0&&(i=e.slice(l,e.length),e=e.slice(0,l)),x.isFunction(n)?(r=n,n=t):n&&"object"==typeof n&&(a="POST"),s.length>0&&x.ajax({url:e,type:a,dataType:"html",data:n}).done(function(e){o=arguments,s.html(i?x("<div>").append(x.parseHTML(e)).find(i):e)}).complete(r&&function(e,t){s.each(r,o||[e.responseText,t,e])}),this},x.each(["ajaxStart","ajaxStop","ajaxComplete","ajaxError","ajaxSuccess","ajaxSend"],function(e,t){x.fn[t]=function(e){return this.on(t,e)}}),x.extend({active:0,lastModified:{},etag:{},ajaxSettings:{url:yn,type:"GET",isLocal:Cn.test(mn[1]),global:!0,processData:!0,async:!0,contentType:"application/x-www-form-urlencoded; charset=UTF-8",accepts:{"*":Dn,text:"text/plain",html:"text/html",xml:"application/xml, text/xml",json:"application/json, text/javascript"},contents:{xml:/xml/,html:/html/,json:/json/},responseFields:{xml:"responseXML",text:"responseText",json:"responseJSON"},converters:{"* text":String,"text html":!0,"text json":x.parseJSON,"text xml":x.parseXML},flatOptions:{url:!0,context:!0}},ajaxSetup:function(e,t){return t?_n(_n(e,x.ajaxSettings),t):_n(x.ajaxSettings,e)},ajaxPrefilter:Hn(An),ajaxTransport:Hn(jn),ajax:function(e,n){"object"==typeof e&&(n=e,e=t),n=n||{};var r,i,o,a,s,l,u,c,p=x.ajaxSetup({},n),f=p.context||p,d=p.context&&(f.nodeType||f.jquery)?x(f):x.event,h=x.Deferred(),g=x.Callbacks("once memory"),m=p.statusCode||{},y={},v={},b=0,w="canceled",C={readyState:0,getResponseHeader:function(e){var t;if(2===b){if(!c){c={};while(t=Tn.exec(a))c[t[1].toLowerCase()]=t[2]}t=c[e.toLowerCase()]}return null==t?null:t},getAllResponseHeaders:function(){return 2===b?a:null},setRequestHeader:function(e,t){var n=e.toLowerCase();return b||(e=v[n]=v[n]||e,y[e]=t),this},overrideMimeType:function(e){return b||(p.mimeType=e),this},statusCode:function(e){var t;if(e)if(2>b)for(t in e)m[t]=[m[t],e[t]];else C.always(e[C.status]);return this},abort:function(e){var t=e||w;return u&&u.abort(t),k(0,t),this}};if(h.promise(C).complete=g.add,C.success=C.done,C.error=C.fail,p.url=((e||p.url||yn)+"").replace(xn,"").replace(kn,mn[1]+"//"),p.type=n.method||n.type||p.method||p.type,p.dataTypes=x.trim(p.dataType||"*").toLowerCase().match(T)||[""],null==p.crossDomain&&(r=En.exec(p.url.toLowerCase()),p.crossDomain=!(!r||r[1]===mn[1]&&r[2]===mn[2]&&(r[3]||("http:"===r[1]?"80":"443"))===(mn[3]||("http:"===mn[1]?"80":"443")))),p.data&&p.processData&&"string"!=typeof p.data&&(p.data=x.param(p.data,p.traditional)),qn(An,p,n,C),2===b)return C;l=p.global,l&&0===x.active++&&x.event.trigger("ajaxStart"),p.type=p.type.toUpperCase(),p.hasContent=!Nn.test(p.type),o=p.url,p.hasContent||(p.data&&(o=p.url+=(bn.test(o)?"&":"?")+p.data,delete p.data),p.cache===!1&&(p.url=wn.test(o)?o.replace(wn,"$1_="+vn++):o+(bn.test(o)?"&":"?")+"_="+vn++)),p.ifModified&&(x.lastModified[o]&&C.setRequestHeader("If-Modified-Since",x.lastModified[o]),x.etag[o]&&C.setRequestHeader("If-None-Match",x.etag[o])),(p.data&&p.hasContent&&p.contentType!==!1||n.contentType)&&C.setRequestHeader("Content-Type",p.contentType),C.setRequestHeader("Accept",p.dataTypes[0]&&p.accepts[p.dataTypes[0]]?p.accepts[p.dataTypes[0]]+("*"!==p.dataTypes[0]?", "+Dn+"; q=0.01":""):p.accepts["*"]);for(i in p.headers)C.setRequestHeader(i,p.headers[i]);if(p.beforeSend&&(p.beforeSend.call(f,C,p)===!1||2===b))return C.abort();w="abort";for(i in{success:1,error:1,complete:1})C[i](p[i]);if(u=qn(jn,p,n,C)){C.readyState=1,l&&d.trigger("ajaxSend",[C,p]),p.async&&p.timeout>0&&(s=setTimeout(function(){C.abort("timeout")},p.timeout));try{b=1,u.send(y,k)}catch(N){if(!(2>b))throw N;k(-1,N)}}else k(-1,"No Transport");function k(e,n,r,i){var c,y,v,w,T,N=n;2!==b&&(b=2,s&&clearTimeout(s),u=t,a=i||"",C.readyState=e>0?4:0,c=e>=200&&300>e||304===e,r&&(w=Mn(p,C,r)),w=On(p,w,C,c),c?(p.ifModified&&(T=C.getResponseHeader("Last-Modified"),T&&(x.lastModified[o]=T),T=C.getResponseHeader("etag"),T&&(x.etag[o]=T)),204===e||"HEAD"===p.type?N="nocontent":304===e?N="notmodified":(N=w.state,y=w.data,v=w.error,c=!v)):(v=N,(e||!N)&&(N="error",0>e&&(e=0))),C.status=e,C.statusText=(n||N)+"",c?h.resolveWith(f,[y,N,C]):h.rejectWith(f,[C,N,v]),C.statusCode(m),m=t,l&&d.trigger(c?"ajaxSuccess":"ajaxError",[C,p,c?y:v]),g.fireWith(f,[C,N]),l&&(d.trigger("ajaxComplete",[C,p]),--x.active||x.event.trigger("ajaxStop")))}return C},getJSON:function(e,t,n){return x.get(e,t,n,"json")},getScript:function(e,n){return x.get(e,t,n,"script")}}),x.each(["get","post"],function(e,n){x[n]=function(e,r,i,o){return x.isFunction(r)&&(o=o||i,i=r,r=t),x.ajax({url:e,type:n,dataType:o,data:r,success:i})}});function Mn(e,n,r){var i,o,a,s,l=e.contents,u=e.dataTypes;while("*"===u[0])u.shift(),o===t&&(o=e.mimeType||n.getResponseHeader("Content-Type"));if(o)for(s in l)if(l[s]&&l[s].test(o)){u.unshift(s);break}if(u[0]in r)a=u[0];else{for(s in r){if(!u[0]||e.converters[s+" "+u[0]]){a=s;break}i||(i=s)}a=a||i}return a?(a!==u[0]&&u.unshift(a),r[a]):t}function On(e,t,n,r){var i,o,a,s,l,u={},c=e.dataTypes.slice();if(c[1])for(a in e.converters)u[a.toLowerCase()]=e.converters[a];o=c.shift();while(o)if(e.responseFields[o]&&(n[e.responseFields[o]]=t),!l&&r&&e.dataFilter&&(t=e.dataFilter(t,e.dataType)),l=o,o=c.shift())if("*"===o)o=l;else if("*"!==l&&l!==o){if(a=u[l+" "+o]||u["* "+o],!a)for(i in u)if(s=i.split(" "),s[1]===o&&(a=u[l+" "+s[0]]||u["* "+s[0]])){a===!0?a=u[i]:u[i]!==!0&&(o=s[0],c.unshift(s[1]));break}if(a!==!0)if(a&&e["throws"])t=a(t);else try{t=a(t)}catch(p){return{state:"parsererror",error:a?p:"No conversion from "+l+" to "+o}}}return{state:"success",data:t}}x.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/(?:java|ecma)script/},converters:{"text script":function(e){return x.globalEval(e),e}}}),x.ajaxPrefilter("script",function(e){e.cache===t&&(e.cache=!1),e.crossDomain&&(e.type="GET",e.global=!1)}),x.ajaxTransport("script",function(e){if(e.crossDomain){var n,r=a.head||x("head")[0]||a.documentElement;return{send:function(t,i){n=a.createElement("script"),n.async=!0,e.scriptCharset&&(n.charset=e.scriptCharset),n.src=e.url,n.onload=n.onreadystatechange=function(e,t){(t||!n.readyState||/loaded|complete/.test(n.readyState))&&(n.onload=n.onreadystatechange=null,n.parentNode&&n.parentNode.removeChild(n),n=null,t||i(200,"success"))},r.insertBefore(n,r.firstChild)},abort:function(){n&&n.onload(t,!0)}}}});var Fn=[],Bn=/(=)\?(?=&|$)|\?\?/;x.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var e=Fn.pop()||x.expando+"_"+vn++;return this[e]=!0,e}}),x.ajaxPrefilter("json jsonp",function(n,r,i){var o,a,s,l=n.jsonp!==!1&&(Bn.test(n.url)?"url":"string"==typeof n.data&&!(n.contentType||"").indexOf("application/x-www-form-urlencoded")&&Bn.test(n.data)&&"data");return l||"jsonp"===n.dataTypes[0]?(o=n.jsonpCallback=x.isFunction(n.jsonpCallback)?n.jsonpCallback():n.jsonpCallback,l?n[l]=n[l].replace(Bn,"$1"+o):n.jsonp!==!1&&(n.url+=(bn.test(n.url)?"&":"?")+n.jsonp+"="+o),n.converters["script json"]=function(){return s||x.error(o+" was not called"),s[0]},n.dataTypes[0]="json",a=e[o],e[o]=function(){s=arguments},i.always(function(){e[o]=a,n[o]&&(n.jsonpCallback=r.jsonpCallback,Fn.push(o)),s&&x.isFunction(a)&&a(s[0]),s=a=t}),"script"):t});var Pn,Rn,Wn=0,$n=e.ActiveXObject&&function(){var e;for(e in Pn)Pn[e](t,!0)};function In(){try{return new e.XMLHttpRequest}catch(t){}}function zn(){try{return new e.ActiveXObject("Microsoft.XMLHTTP")}catch(t){}}x.ajaxSettings.xhr=e.ActiveXObject?function(){return!this.isLocal&&In()||zn()}:In,Rn=x.ajaxSettings.xhr(),x.support.cors=!!Rn&&"withCredentials"in Rn,Rn=x.support.ajax=!!Rn,Rn&&x.ajaxTransport(function(n){if(!n.crossDomain||x.support.cors){var r;return{send:function(i,o){var a,s,l=n.xhr();if(n.username?l.open(n.type,n.url,n.async,n.username,n.password):l.open(n.type,n.url,n.async),n.xhrFields)for(s in n.xhrFields)l[s]=n.xhrFields[s];n.mimeType&&l.overrideMimeType&&l.overrideMimeType(n.mimeType),n.crossDomain||i["X-Requested-With"]||(i["X-Requested-With"]="XMLHttpRequest");try{for(s in i)l.setRequestHeader(s,i[s])}catch(u){}l.send(n.hasContent&&n.data||null),r=function(e,i){var s,u,c,p;try{if(r&&(i||4===l.readyState))if(r=t,a&&(l.onreadystatechange=x.noop,$n&&delete Pn[a]),i)4!==l.readyState&&l.abort();else{p={},s=l.status,u=l.getAllResponseHeaders(),"string"==typeof l.responseText&&(p.text=l.responseText);try{c=l.statusText}catch(f){c=""}s||!n.isLocal||n.crossDomain?1223===s&&(s=204):s=p.text?200:404}}catch(d){i||o(-1,d)}p&&o(s,c,p,u)},n.async?4===l.readyState?setTimeout(r):(a=++Wn,$n&&(Pn||(Pn={},x(e).unload($n)),Pn[a]=r),l.onreadystatechange=r):r()},abort:function(){r&&r(t,!0)}}}});var Xn,Un,Vn=/^(?:toggle|show|hide)$/,Yn=RegExp("^(?:([+-])=|)("+w+")([a-z%]*)$","i"),Jn=/queueHooks$/,Gn=[nr],Qn={"*":[function(e,t){var n=this.createTween(e,t),r=n.cur(),i=Yn.exec(t),o=i&&i[3]||(x.cssNumber[e]?"":"px"),a=(x.cssNumber[e]||"px"!==o&&+r)&&Yn.exec(x.css(n.elem,e)),s=1,l=20;if(a&&a[3]!==o){o=o||a[3],i=i||[],a=+r||1;do s=s||".5",a/=s,x.style(n.elem,e,a+o);while(s!==(s=n.cur()/r)&&1!==s&&--l)}return i&&(a=n.start=+a||+r||0,n.unit=o,n.end=i[1]?a+(i[1]+1)*i[2]:+i[2]),n}]};function Kn(){return setTimeout(function(){Xn=t}),Xn=x.now()}function Zn(e,t,n){var r,i=(Qn[t]||[]).concat(Qn["*"]),o=0,a=i.length;for(;a>o;o++)if(r=i[o].call(n,t,e))return r}function er(e,t,n){var r,i,o=0,a=Gn.length,s=x.Deferred().always(function(){delete l.elem}),l=function(){if(i)return!1;var t=Xn||Kn(),n=Math.max(0,u.startTime+u.duration-t),r=n/u.duration||0,o=1-r,a=0,l=u.tweens.length;for(;l>a;a++)u.tweens[a].run(o);return s.notifyWith(e,[u,o,n]),1>o&&l?n:(s.resolveWith(e,[u]),!1)},u=s.promise({elem:e,props:x.extend({},t),opts:x.extend(!0,{specialEasing:{}},n),originalProperties:t,originalOptions:n,startTime:Xn||Kn(),duration:n.duration,tweens:[],createTween:function(t,n){var r=x.Tween(e,u.opts,t,n,u.opts.specialEasing[t]||u.opts.easing);return u.tweens.push(r),r},stop:function(t){var n=0,r=t?u.tweens.length:0;if(i)return this;for(i=!0;r>n;n++)u.tweens[n].run(1);return t?s.resolveWith(e,[u,t]):s.rejectWith(e,[u,t]),this}}),c=u.props;for(tr(c,u.opts.specialEasing);a>o;o++)if(r=Gn[o].call(u,e,c,u.opts))return r;return x.map(c,Zn,u),x.isFunction(u.opts.start)&&u.opts.start.call(e,u),x.fx.timer(x.extend(l,{elem:e,anim:u,queue:u.opts.queue})),u.progress(u.opts.progress).done(u.opts.done,u.opts.complete).fail(u.opts.fail).always(u.opts.always)}function tr(e,t){var n,r,i,o,a;for(n in e)if(r=x.camelCase(n),i=t[r],o=e[n],x.isArray(o)&&(i=o[1],o=e[n]=o[0]),n!==r&&(e[r]=o,delete e[n]),a=x.cssHooks[r],a&&"expand"in a){o=a.expand(o),delete e[r];for(n in o)n in e||(e[n]=o[n],t[n]=i)}else t[r]=i}x.Animation=x.extend(er,{tweener:function(e,t){x.isFunction(e)?(t=e,e=["*"]):e=e.split(" ");var n,r=0,i=e.length;for(;i>r;r++)n=e[r],Qn[n]=Qn[n]||[],Qn[n].unshift(t)},prefilter:function(e,t){t?Gn.unshift(e):Gn.push(e)}});function nr(e,t,n){var r,i,o,a,s,l,u=this,c={},p=e.style,f=e.nodeType&&nn(e),d=x._data(e,"fxshow");n.queue||(s=x._queueHooks(e,"fx"),null==s.unqueued&&(s.unqueued=0,l=s.empty.fire,s.empty.fire=function(){s.unqueued||l()}),s.unqueued++,u.always(function(){u.always(function(){s.unqueued--,x.queue(e,"fx").length||s.empty.fire()})})),1===e.nodeType&&("height"in t||"width"in t)&&(n.overflow=[p.overflow,p.overflowX,p.overflowY],"inline"===x.css(e,"display")&&"none"===x.css(e,"float")&&(x.support.inlineBlockNeedsLayout&&"inline"!==ln(e.nodeName)?p.zoom=1:p.display="inline-block")),n.overflow&&(p.overflow="hidden",x.support.shrinkWrapBlocks||u.always(function(){p.overflow=n.overflow[0],p.overflowX=n.overflow[1],p.overflowY=n.overflow[2]}));for(r in t)if(i=t[r],Vn.exec(i)){if(delete t[r],o=o||"toggle"===i,i===(f?"hide":"show"))continue;c[r]=d&&d[r]||x.style(e,r)}if(!x.isEmptyObject(c)){d?"hidden"in d&&(f=d.hidden):d=x._data(e,"fxshow",{}),o&&(d.hidden=!f),f?x(e).show():u.done(function(){x(e).hide()}),u.done(function(){var t;x._removeData(e,"fxshow");for(t in c)x.style(e,t,c[t])});for(r in c)a=Zn(f?d[r]:0,r,u),r in d||(d[r]=a.start,f&&(a.end=a.start,a.start="width"===r||"height"===r?1:0))}}function rr(e,t,n,r,i){return new rr.prototype.init(e,t,n,r,i)}x.Tween=rr,rr.prototype={constructor:rr,init:function(e,t,n,r,i,o){this.elem=e,this.prop=n,this.easing=i||"swing",this.options=t,this.start=this.now=this.cur(),this.end=r,this.unit=o||(x.cssNumber[n]?"":"px")},cur:function(){var e=rr.propHooks[this.prop];return e&&e.get?e.get(this):rr.propHooks._default.get(this)},run:function(e){var t,n=rr.propHooks[this.prop];return this.pos=t=this.options.duration?x.easing[this.easing](e,this.options.duration*e,0,1,this.options.duration):e,this.now=(this.end-this.start)*t+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),n&&n.set?n.set(this):rr.propHooks._default.set(this),this}},rr.prototype.init.prototype=rr.prototype,rr.propHooks={_default:{get:function(e){var t;return null==e.elem[e.prop]||e.elem.style&&null!=e.elem.style[e.prop]?(t=x.css(e.elem,e.prop,""),t&&"auto"!==t?t:0):e.elem[e.prop]},set:function(e){x.fx.step[e.prop]?x.fx.step[e.prop](e):e.elem.style&&(null!=e.elem.style[x.cssProps[e.prop]]||x.cssHooks[e.prop])?x.style(e.elem,e.prop,e.now+e.unit):e.elem[e.prop]=e.now}}},rr.propHooks.scrollTop=rr.propHooks.scrollLeft={set:function(e){e.elem.nodeType&&e.elem.parentNode&&(e.elem[e.prop]=e.now)}},x.each(["toggle","show","hide"],function(e,t){var n=x.fn[t];x.fn[t]=function(e,r,i){return null==e||"boolean"==typeof e?n.apply(this,arguments):this.animate(ir(t,!0),e,r,i)}}),x.fn.extend({fadeTo:function(e,t,n,r){return this.filter(nn).css("opacity",0).show().end().animate({opacity:t},e,n,r)},animate:function(e,t,n,r){var i=x.isEmptyObject(e),o=x.speed(t,n,r),a=function(){var t=er(this,x.extend({},e),o);(i||x._data(this,"finish"))&&t.stop(!0)};return a.finish=a,i||o.queue===!1?this.each(a):this.queue(o.queue,a)},stop:function(e,n,r){var i=function(e){var t=e.stop;delete e.stop,t(r)};return"string"!=typeof e&&(r=n,n=e,e=t),n&&e!==!1&&this.queue(e||"fx",[]),this.each(function(){var t=!0,n=null!=e&&e+"queueHooks",o=x.timers,a=x._data(this);if(n)a[n]&&a[n].stop&&i(a[n]);else for(n in a)a[n]&&a[n].stop&&Jn.test(n)&&i(a[n]);for(n=o.length;n--;)o[n].elem!==this||null!=e&&o[n].queue!==e||(o[n].anim.stop(r),t=!1,o.splice(n,1));(t||!r)&&x.dequeue(this,e)})},finish:function(e){return e!==!1&&(e=e||"fx"),this.each(function(){var t,n=x._data(this),r=n[e+"queue"],i=n[e+"queueHooks"],o=x.timers,a=r?r.length:0;for(n.finish=!0,x.queue(this,e,[]),i&&i.stop&&i.stop.call(this,!0),t=o.length;t--;)o[t].elem===this&&o[t].queue===e&&(o[t].anim.stop(!0),o.splice(t,1));for(t=0;a>t;t++)r[t]&&r[t].finish&&r[t].finish.call(this);delete n.finish})}});function ir(e,t){var n,r={height:e},i=0;for(t=t?1:0;4>i;i+=2-t)n=Zt[i],r["margin"+n]=r["padding"+n]=e;return t&&(r.opacity=r.width=e),r}x.each({slideDown:ir("show"),slideUp:ir("hide"),slideToggle:ir("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(e,t){x.fn[e]=function(e,n,r){return this.animate(t,e,n,r)}}),x.speed=function(e,t,n){var r=e&&"object"==typeof e?x.extend({},e):{complete:n||!n&&t||x.isFunction(e)&&e,duration:e,easing:n&&t||t&&!x.isFunction(t)&&t};return r.duration=x.fx.off?0:"number"==typeof r.duration?r.duration:r.duration in x.fx.speeds?x.fx.speeds[r.duration]:x.fx.speeds._default,(null==r.queue||r.queue===!0)&&(r.queue="fx"),r.old=r.complete,r.complete=function(){x.isFunction(r.old)&&r.old.call(this),r.queue&&x.dequeue(this,r.queue)},r},x.easing={linear:function(e){return e},swing:function(e){return.5-Math.cos(e*Math.PI)/2}},x.timers=[],x.fx=rr.prototype.init,x.fx.tick=function(){var e,n=x.timers,r=0;for(Xn=x.now();n.length>r;r++)e=n[r],e()||n[r]!==e||n.splice(r--,1);n.length||x.fx.stop(),Xn=t},x.fx.timer=function(e){e()&&x.timers.push(e)&&x.fx.start()},x.fx.interval=13,x.fx.start=function(){Un||(Un=setInterval(x.fx.tick,x.fx.interval))},x.fx.stop=function(){clearInterval(Un),Un=null},x.fx.speeds={slow:600,fast:200,_default:400},x.fx.step={},x.expr&&x.expr.filters&&(x.expr.filters.animated=function(e){return x.grep(x.timers,function(t){return e===t.elem}).length}),x.fn.offset=function(e){if(arguments.length)return e===t?this:this.each(function(t){x.offset.setOffset(this,e,t)});var n,r,o={top:0,left:0},a=this[0],s=a&&a.ownerDocument;if(s)return n=s.documentElement,x.contains(n,a)?(typeof a.getBoundingClientRect!==i&&(o=a.getBoundingClientRect()),r=or(s),{top:o.top+(r.pageYOffset||n.scrollTop)-(n.clientTop||0),left:o.left+(r.pageXOffset||n.scrollLeft)-(n.clientLeft||0)}):o},x.offset={setOffset:function(e,t,n){var r=x.css(e,"position");"static"===r&&(e.style.position="relative");var i=x(e),o=i.offset(),a=x.css(e,"top"),s=x.css(e,"left"),l=("absolute"===r||"fixed"===r)&&x.inArray("auto",[a,s])>-1,u={},c={},p,f;l?(c=i.position(),p=c.top,f=c.left):(p=parseFloat(a)||0,f=parseFloat(s)||0),x.isFunction(t)&&(t=t.call(e,n,o)),null!=t.top&&(u.top=t.top-o.top+p),null!=t.left&&(u.left=t.left-o.left+f),"using"in t?t.using.call(e,u):i.css(u)}},x.fn.extend({position:function(){if(this[0]){var e,t,n={top:0,left:0},r=this[0];return"fixed"===x.css(r,"position")?t=r.getBoundingClientRect():(e=this.offsetParent(),t=this.offset(),x.nodeName(e[0],"html")||(n=e.offset()),n.top+=x.css(e[0],"borderTopWidth",!0),n.left+=x.css(e[0],"borderLeftWidth",!0)),{top:t.top-n.top-x.css(r,"marginTop",!0),left:t.left-n.left-x.css(r,"marginLeft",!0)}}},offsetParent:function(){return this.map(function(){var e=this.offsetParent||s;while(e&&!x.nodeName(e,"html")&&"static"===x.css(e,"position"))e=e.offsetParent;return e||s})}}),x.each({scrollLeft:"pageXOffset",scrollTop:"pageYOffset"},function(e,n){var r=/Y/.test(n);x.fn[e]=function(i){return x.access(this,function(e,i,o){var a=or(e);return o===t?a?n in a?a[n]:a.document.documentElement[i]:e[i]:(a?a.scrollTo(r?x(a).scrollLeft():o,r?o:x(a).scrollTop()):e[i]=o,t)},e,i,arguments.length,null)}});function or(e){return x.isWindow(e)?e:9===e.nodeType?e.defaultView||e.parentWindow:!1}x.each({Height:"height",Width:"width"},function(e,n){x.each({padding:"inner"+e,content:n,"":"outer"+e},function(r,i){x.fn[i]=function(i,o){var a=arguments.length&&(r||"boolean"!=typeof i),s=r||(i===!0||o===!0?"margin":"border");return x.access(this,function(n,r,i){var o;return x.isWindow(n)?n.document.documentElement["client"+e]:9===n.nodeType?(o=n.documentElement,Math.max(n.body["scroll"+e],o["scroll"+e],n.body["offset"+e],o["offset"+e],o["client"+e])):i===t?x.css(n,r,s):x.style(n,r,i,s)},n,a?i:t,a,null)}})}),x.fn.size=function(){return this.length},x.fn.andSelf=x.fn.addBack,"object"==typeof module&&module&&"object"==typeof module.exports?module.exports=x:(e.jQuery=e.$=x,"function"==typeof define&&define.amd&&define("jquery",[],function(){return x}))})(window);
});

Numbas.queueScript('knockout',[],function(module) {
/*!
 * Knockout JavaScript library v3.2.0
 * (c) Steven Sanderson - http://knockoutjs.com/
 * License: MIT (http://www.opensource.org/licenses/mit-license.php)
 */

(function() {(function(p){var s=this||(0,eval)("this"),v=s.document,L=s.navigator,w=s.jQuery,D=s.JSON;(function(p){"function"===typeof require&&"object"===typeof exports&&"object"===typeof module?p(module.exports||exports,require):"function"===typeof define&&define.amd?define(["exports","require"],p):p(s.ko={})})(function(M,N){function H(a,d){return null===a||typeof a in R?a===d:!1}function S(a,d){var c;return function(){c||(c=setTimeout(function(){c=p;a()},d))}}function T(a,d){var c;return function(){clearTimeout(c);
c=setTimeout(a,d)}}function I(b,d,c,e){a.d[b]={init:function(b,h,k,f,m){var l,q;a.s(function(){var f=a.a.c(h()),k=!c!==!f,z=!q;if(z||d||k!==l)z&&a.Y.la()&&(q=a.a.ia(a.f.childNodes(b),!0)),k?(z||a.f.T(b,a.a.ia(q)),a.Ca(e?e(m,f):m,b)):a.f.ja(b),l=k},null,{o:b});return{controlsDescendantBindings:!0}}};a.h.ha[b]=!1;a.f.Q[b]=!0}var a="undefined"!==typeof M?M:{};a.b=function(b,d){for(var c=b.split("."),e=a,g=0;g<c.length-1;g++)e=e[c[g]];e[c[c.length-1]]=d};a.A=function(a,d,c){a[d]=c};a.version="3.2.0";
a.b("version",a.version);a.a=function(){function b(a,b){for(var c in a)a.hasOwnProperty(c)&&b(c,a[c])}function d(a,b){if(b)for(var c in b)b.hasOwnProperty(c)&&(a[c]=b[c]);return a}function c(a,b){a.__proto__=b;return a}var e={__proto__:[]}instanceof Array,g={},h={};g[L&&/Firefox\/2/i.test(L.userAgent)?"KeyboardEvent":"UIEvents"]=["keyup","keydown","keypress"];g.MouseEvents="click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave".split(" ");b(g,function(a,b){if(b.length)for(var c=
0,d=b.length;c<d;c++)h[b[c]]=a});var k={propertychange:!0},f=v&&function(){for(var a=3,b=v.createElement("div"),c=b.getElementsByTagName("i");b.innerHTML="\x3c!--[if gt IE "+ ++a+"]><i></i><![endif]--\x3e",c[0];);return 4<a?a:p}();return{vb:["authenticity_token",/^__RequestVerificationToken(_.*)?$/],u:function(a,b){for(var c=0,d=a.length;c<d;c++)b(a[c],c)},m:function(a,b){if("function"==typeof Array.prototype.indexOf)return Array.prototype.indexOf.call(a,b);for(var c=0,d=a.length;c<d;c++)if(a[c]===
b)return c;return-1},qb:function(a,b,c){for(var d=0,f=a.length;d<f;d++)if(b.call(c,a[d],d))return a[d];return null},ua:function(m,b){var c=a.a.m(m,b);0<c?m.splice(c,1):0===c&&m.shift()},rb:function(m){m=m||[];for(var b=[],c=0,d=m.length;c<d;c++)0>a.a.m(b,m[c])&&b.push(m[c]);return b},Da:function(a,b){a=a||[];for(var c=[],d=0,f=a.length;d<f;d++)c.push(b(a[d],d));return c},ta:function(a,b){a=a||[];for(var c=[],d=0,f=a.length;d<f;d++)b(a[d],d)&&c.push(a[d]);return c},ga:function(a,b){if(b instanceof
Array)a.push.apply(a,b);else for(var c=0,d=b.length;c<d;c++)a.push(b[c]);return a},ea:function(b,c,d){var f=a.a.m(a.a.Xa(b),c);0>f?d&&b.push(c):d||b.splice(f,1)},xa:e,extend:d,za:c,Aa:e?c:d,G:b,na:function(a,b){if(!a)return a;var c={},d;for(d in a)a.hasOwnProperty(d)&&(c[d]=b(a[d],d,a));return c},Ka:function(b){for(;b.firstChild;)a.removeNode(b.firstChild)},oc:function(b){b=a.a.S(b);for(var c=v.createElement("div"),d=0,f=b.length;d<f;d++)c.appendChild(a.R(b[d]));return c},ia:function(b,c){for(var d=
0,f=b.length,e=[];d<f;d++){var k=b[d].cloneNode(!0);e.push(c?a.R(k):k)}return e},T:function(b,c){a.a.Ka(b);if(c)for(var d=0,f=c.length;d<f;d++)b.appendChild(c[d])},Lb:function(b,c){var d=b.nodeType?[b]:b;if(0<d.length){for(var f=d[0],e=f.parentNode,k=0,g=c.length;k<g;k++)e.insertBefore(c[k],f);k=0;for(g=d.length;k<g;k++)a.removeNode(d[k])}},ka:function(a,b){if(a.length){for(b=8===b.nodeType&&b.parentNode||b;a.length&&a[0].parentNode!==b;)a.shift();if(1<a.length){var c=a[0],d=a[a.length-1];for(a.length=
0;c!==d;)if(a.push(c),c=c.nextSibling,!c)return;a.push(d)}}return a},Nb:function(a,b){7>f?a.setAttribute("selected",b):a.selected=b},cb:function(a){return null===a||a===p?"":a.trim?a.trim():a.toString().replace(/^[\s\xa0]+|[\s\xa0]+$/g,"")},vc:function(a,b){a=a||"";return b.length>a.length?!1:a.substring(0,b.length)===b},cc:function(a,b){if(a===b)return!0;if(11===a.nodeType)return!1;if(b.contains)return b.contains(3===a.nodeType?a.parentNode:a);if(b.compareDocumentPosition)return 16==(b.compareDocumentPosition(a)&
16);for(;a&&a!=b;)a=a.parentNode;return!!a},Ja:function(b){return a.a.cc(b,b.ownerDocument.documentElement)},ob:function(b){return!!a.a.qb(b,a.a.Ja)},t:function(a){return a&&a.tagName&&a.tagName.toLowerCase()},n:function(b,c,d){var e=f&&k[c];if(!e&&w)w(b).bind(c,d);else if(e||"function"!=typeof b.addEventListener)if("undefined"!=typeof b.attachEvent){var g=function(a){d.call(b,a)},h="on"+c;b.attachEvent(h,g);a.a.w.da(b,function(){b.detachEvent(h,g)})}else throw Error("Browser doesn't support addEventListener or attachEvent");
else b.addEventListener(c,d,!1)},oa:function(b,c){if(!b||!b.nodeType)throw Error("element must be a DOM node when calling triggerEvent");var d;"input"===a.a.t(b)&&b.type&&"click"==c.toLowerCase()?(d=b.type,d="checkbox"==d||"radio"==d):d=!1;if(w&&!d)w(b).trigger(c);else if("function"==typeof v.createEvent)if("function"==typeof b.dispatchEvent)d=v.createEvent(h[c]||"HTMLEvents"),d.initEvent(c,!0,!0,s,0,0,0,0,0,!1,!1,!1,!1,0,b),b.dispatchEvent(d);else throw Error("The supplied element doesn't support dispatchEvent");
else if(d&&b.click)b.click();else if("undefined"!=typeof b.fireEvent)b.fireEvent("on"+c);else throw Error("Browser doesn't support triggering events");},c:function(b){return a.C(b)?b():b},Xa:function(b){return a.C(b)?b.v():b},Ba:function(b,c,d){if(c){var f=/\S+/g,e=b.className.match(f)||[];a.a.u(c.match(f),function(b){a.a.ea(e,b,d)});b.className=e.join(" ")}},bb:function(b,c){var d=a.a.c(c);if(null===d||d===p)d="";var f=a.f.firstChild(b);!f||3!=f.nodeType||a.f.nextSibling(f)?a.f.T(b,[b.ownerDocument.createTextNode(d)]):
f.data=d;a.a.fc(b)},Mb:function(a,b){a.name=b;if(7>=f)try{a.mergeAttributes(v.createElement("<input name='"+a.name+"'/>"),!1)}catch(c){}},fc:function(a){9<=f&&(a=1==a.nodeType?a:a.parentNode,a.style&&(a.style.zoom=a.style.zoom))},dc:function(a){if(f){var b=a.style.width;a.style.width=0;a.style.width=b}},sc:function(b,c){b=a.a.c(b);c=a.a.c(c);for(var d=[],f=b;f<=c;f++)d.push(f);return d},S:function(a){for(var b=[],c=0,d=a.length;c<d;c++)b.push(a[c]);return b},yc:6===f,zc:7===f,L:f,xb:function(b,c){for(var d=
a.a.S(b.getElementsByTagName("input")).concat(a.a.S(b.getElementsByTagName("textarea"))),f="string"==typeof c?function(a){return a.name===c}:function(a){return c.test(a.name)},e=[],k=d.length-1;0<=k;k--)f(d[k])&&e.push(d[k]);return e},pc:function(b){return"string"==typeof b&&(b=a.a.cb(b))?D&&D.parse?D.parse(b):(new Function("return "+b))():null},eb:function(b,c,d){if(!D||!D.stringify)throw Error("Cannot find JSON.stringify(). Some browsers (e.g., IE < 8) don't support it natively, but you can overcome this by adding a script reference to json2.js, downloadable from http://www.json.org/json2.js");
return D.stringify(a.a.c(b),c,d)},qc:function(c,d,f){f=f||{};var e=f.params||{},k=f.includeFields||this.vb,g=c;if("object"==typeof c&&"form"===a.a.t(c))for(var g=c.action,h=k.length-1;0<=h;h--)for(var r=a.a.xb(c,k[h]),E=r.length-1;0<=E;E--)e[r[E].name]=r[E].value;d=a.a.c(d);var y=v.createElement("form");y.style.display="none";y.action=g;y.method="post";for(var p in d)c=v.createElement("input"),c.type="hidden",c.name=p,c.value=a.a.eb(a.a.c(d[p])),y.appendChild(c);b(e,function(a,b){var c=v.createElement("input");
c.type="hidden";c.name=a;c.value=b;y.appendChild(c)});v.body.appendChild(y);f.submitter?f.submitter(y):y.submit();setTimeout(function(){y.parentNode.removeChild(y)},0)}}}();a.b("utils",a.a);a.b("utils.arrayForEach",a.a.u);a.b("utils.arrayFirst",a.a.qb);a.b("utils.arrayFilter",a.a.ta);a.b("utils.arrayGetDistinctValues",a.a.rb);a.b("utils.arrayIndexOf",a.a.m);a.b("utils.arrayMap",a.a.Da);a.b("utils.arrayPushAll",a.a.ga);a.b("utils.arrayRemoveItem",a.a.ua);a.b("utils.extend",a.a.extend);a.b("utils.fieldsIncludedWithJsonPost",
a.a.vb);a.b("utils.getFormFields",a.a.xb);a.b("utils.peekObservable",a.a.Xa);a.b("utils.postJson",a.a.qc);a.b("utils.parseJson",a.a.pc);a.b("utils.registerEventHandler",a.a.n);a.b("utils.stringifyJson",a.a.eb);a.b("utils.range",a.a.sc);a.b("utils.toggleDomNodeCssClass",a.a.Ba);a.b("utils.triggerEvent",a.a.oa);a.b("utils.unwrapObservable",a.a.c);a.b("utils.objectForEach",a.a.G);a.b("utils.addOrRemoveItem",a.a.ea);a.b("unwrap",a.a.c);Function.prototype.bind||(Function.prototype.bind=function(a){var d=
this,c=Array.prototype.slice.call(arguments);a=c.shift();return function(){return d.apply(a,c.concat(Array.prototype.slice.call(arguments)))}});a.a.e=new function(){function a(b,h){var k=b[c];if(!k||"null"===k||!e[k]){if(!h)return p;k=b[c]="ko"+d++;e[k]={}}return e[k]}var d=0,c="__ko__"+(new Date).getTime(),e={};return{get:function(c,d){var e=a(c,!1);return e===p?p:e[d]},set:function(c,d,e){if(e!==p||a(c,!1)!==p)a(c,!0)[d]=e},clear:function(a){var b=a[c];return b?(delete e[b],a[c]=null,!0):!1},F:function(){return d++ +
c}}};a.b("utils.domData",a.a.e);a.b("utils.domData.clear",a.a.e.clear);a.a.w=new function(){function b(b,d){var f=a.a.e.get(b,c);f===p&&d&&(f=[],a.a.e.set(b,c,f));return f}function d(c){var e=b(c,!1);if(e)for(var e=e.slice(0),f=0;f<e.length;f++)e[f](c);a.a.e.clear(c);a.a.w.cleanExternalData(c);if(g[c.nodeType])for(e=c.firstChild;c=e;)e=c.nextSibling,8===c.nodeType&&d(c)}var c=a.a.e.F(),e={1:!0,8:!0,9:!0},g={1:!0,9:!0};return{da:function(a,c){if("function"!=typeof c)throw Error("Callback must be a function");
b(a,!0).push(c)},Kb:function(d,e){var f=b(d,!1);f&&(a.a.ua(f,e),0==f.length&&a.a.e.set(d,c,p))},R:function(b){if(e[b.nodeType]&&(d(b),g[b.nodeType])){var c=[];a.a.ga(c,b.getElementsByTagName("*"));for(var f=0,m=c.length;f<m;f++)d(c[f])}return b},removeNode:function(b){a.R(b);b.parentNode&&b.parentNode.removeChild(b)},cleanExternalData:function(a){w&&"function"==typeof w.cleanData&&w.cleanData([a])}}};a.R=a.a.w.R;a.removeNode=a.a.w.removeNode;a.b("cleanNode",a.R);a.b("removeNode",a.removeNode);a.b("utils.domNodeDisposal",
a.a.w);a.b("utils.domNodeDisposal.addDisposeCallback",a.a.w.da);a.b("utils.domNodeDisposal.removeDisposeCallback",a.a.w.Kb);(function(){a.a.ba=function(b){var d;if(w)if(w.parseHTML)d=w.parseHTML(b)||[];else{if((d=w.clean([b]))&&d[0]){for(b=d[0];b.parentNode&&11!==b.parentNode.nodeType;)b=b.parentNode;b.parentNode&&b.parentNode.removeChild(b)}}else{var c=a.a.cb(b).toLowerCase();d=v.createElement("div");c=c.match(/^<(thead|tbody|tfoot)/)&&[1,"<table>","</table>"]||!c.indexOf("<tr")&&[2,"<table><tbody>",
"</tbody></table>"]||(!c.indexOf("<td")||!c.indexOf("<th"))&&[3,"<table><tbody><tr>","</tr></tbody></table>"]||[0,"",""];b="ignored<div>"+c[1]+b+c[2]+"</div>";for("function"==typeof s.innerShiv?d.appendChild(s.innerShiv(b)):d.innerHTML=b;c[0]--;)d=d.lastChild;d=a.a.S(d.lastChild.childNodes)}return d};a.a.$a=function(b,d){a.a.Ka(b);d=a.a.c(d);if(null!==d&&d!==p)if("string"!=typeof d&&(d=d.toString()),w)w(b).html(d);else for(var c=a.a.ba(d),e=0;e<c.length;e++)b.appendChild(c[e])}})();a.b("utils.parseHtmlFragment",
a.a.ba);a.b("utils.setHtml",a.a.$a);a.D=function(){function b(c,d){if(c)if(8==c.nodeType){var g=a.D.Gb(c.nodeValue);null!=g&&d.push({bc:c,mc:g})}else if(1==c.nodeType)for(var g=0,h=c.childNodes,k=h.length;g<k;g++)b(h[g],d)}var d={};return{Ua:function(a){if("function"!=typeof a)throw Error("You can only pass a function to ko.memoization.memoize()");var b=(4294967296*(1+Math.random())|0).toString(16).substring(1)+(4294967296*(1+Math.random())|0).toString(16).substring(1);d[b]=a;return"\x3c!--[ko_memo:"+
b+"]--\x3e"},Rb:function(a,b){var g=d[a];if(g===p)throw Error("Couldn't find any memo with ID "+a+". Perhaps it's already been unmemoized.");try{return g.apply(null,b||[]),!0}finally{delete d[a]}},Sb:function(c,d){var g=[];b(c,g);for(var h=0,k=g.length;h<k;h++){var f=g[h].bc,m=[f];d&&a.a.ga(m,d);a.D.Rb(g[h].mc,m);f.nodeValue="";f.parentNode&&f.parentNode.removeChild(f)}},Gb:function(a){return(a=a.match(/^\[ko_memo\:(.*?)\]$/))?a[1]:null}}}();a.b("memoization",a.D);a.b("memoization.memoize",a.D.Ua);
a.b("memoization.unmemoize",a.D.Rb);a.b("memoization.parseMemoText",a.D.Gb);a.b("memoization.unmemoizeDomNodeAndDescendants",a.D.Sb);a.La={throttle:function(b,d){b.throttleEvaluation=d;var c=null;return a.j({read:b,write:function(a){clearTimeout(c);c=setTimeout(function(){b(a)},d)}})},rateLimit:function(a,d){var c,e,g;"number"==typeof d?c=d:(c=d.timeout,e=d.method);g="notifyWhenChangesStop"==e?T:S;a.Ta(function(a){return g(a,c)})},notify:function(a,d){a.equalityComparer="always"==d?null:H}};var R=
{undefined:1,"boolean":1,number:1,string:1};a.b("extenders",a.La);a.Pb=function(b,d,c){this.target=b;this.wa=d;this.ac=c;this.Cb=!1;a.A(this,"dispose",this.K)};a.Pb.prototype.K=function(){this.Cb=!0;this.ac()};a.P=function(){a.a.Aa(this,a.P.fn);this.M={}};var G="change",A={U:function(b,d,c){var e=this;c=c||G;var g=new a.Pb(e,d?b.bind(d):b,function(){a.a.ua(e.M[c],g);e.nb&&e.nb()});e.va&&e.va(c);e.M[c]||(e.M[c]=[]);e.M[c].push(g);return g},notifySubscribers:function(b,d){d=d||G;if(this.Ab(d))try{a.k.Ea();
for(var c=this.M[d].slice(0),e=0,g;g=c[e];++e)g.Cb||g.wa(b)}finally{a.k.end()}},Ta:function(b){var d=this,c=a.C(d),e,g,h;d.qa||(d.qa=d.notifySubscribers,d.notifySubscribers=function(a,b){b&&b!==G?"beforeChange"===b?d.kb(a):d.qa(a,b):d.lb(a)});var k=b(function(){c&&h===d&&(h=d());e=!1;d.Pa(g,h)&&d.qa(g=h)});d.lb=function(a){e=!0;h=a;k()};d.kb=function(a){e||(g=a,d.qa(a,"beforeChange"))}},Ab:function(a){return this.M[a]&&this.M[a].length},yb:function(){var b=0;a.a.G(this.M,function(a,c){b+=c.length});
return b},Pa:function(a,d){return!this.equalityComparer||!this.equalityComparer(a,d)},extend:function(b){var d=this;b&&a.a.G(b,function(b,e){var g=a.La[b];"function"==typeof g&&(d=g(d,e)||d)});return d}};a.A(A,"subscribe",A.U);a.A(A,"extend",A.extend);a.A(A,"getSubscriptionsCount",A.yb);a.a.xa&&a.a.za(A,Function.prototype);a.P.fn=A;a.Db=function(a){return null!=a&&"function"==typeof a.U&&"function"==typeof a.notifySubscribers};a.b("subscribable",a.P);a.b("isSubscribable",a.Db);a.Y=a.k=function(){function b(a){c.push(e);
e=a}function d(){e=c.pop()}var c=[],e,g=0;return{Ea:b,end:d,Jb:function(b){if(e){if(!a.Db(b))throw Error("Only subscribable things can act as dependencies");e.wa(b,b.Vb||(b.Vb=++g))}},B:function(a,c,f){try{return b(),a.apply(c,f||[])}finally{d()}},la:function(){if(e)return e.s.la()},ma:function(){if(e)return e.ma}}}();a.b("computedContext",a.Y);a.b("computedContext.getDependenciesCount",a.Y.la);a.b("computedContext.isInitial",a.Y.ma);a.b("computedContext.isSleeping",a.Y.Ac);a.p=function(b){function d(){if(0<
arguments.length)return d.Pa(c,arguments[0])&&(d.X(),c=arguments[0],d.W()),this;a.k.Jb(d);return c}var c=b;a.P.call(d);a.a.Aa(d,a.p.fn);d.v=function(){return c};d.W=function(){d.notifySubscribers(c)};d.X=function(){d.notifySubscribers(c,"beforeChange")};a.A(d,"peek",d.v);a.A(d,"valueHasMutated",d.W);a.A(d,"valueWillMutate",d.X);return d};a.p.fn={equalityComparer:H};var F=a.p.rc="__ko_proto__";a.p.fn[F]=a.p;a.a.xa&&a.a.za(a.p.fn,a.P.fn);a.Ma=function(b,d){return null===b||b===p||b[F]===p?!1:b[F]===
d?!0:a.Ma(b[F],d)};a.C=function(b){return a.Ma(b,a.p)};a.Ra=function(b){return"function"==typeof b&&b[F]===a.p||"function"==typeof b&&b[F]===a.j&&b.hc?!0:!1};a.b("observable",a.p);a.b("isObservable",a.C);a.b("isWriteableObservable",a.Ra);a.b("isWritableObservable",a.Ra);a.aa=function(b){b=b||[];if("object"!=typeof b||!("length"in b))throw Error("The argument passed when initializing an observable array must be an array, or null, or undefined.");b=a.p(b);a.a.Aa(b,a.aa.fn);return b.extend({trackArrayChanges:!0})};
a.aa.fn={remove:function(b){for(var d=this.v(),c=[],e="function"!=typeof b||a.C(b)?function(a){return a===b}:b,g=0;g<d.length;g++){var h=d[g];e(h)&&(0===c.length&&this.X(),c.push(h),d.splice(g,1),g--)}c.length&&this.W();return c},removeAll:function(b){if(b===p){var d=this.v(),c=d.slice(0);this.X();d.splice(0,d.length);this.W();return c}return b?this.remove(function(c){return 0<=a.a.m(b,c)}):[]},destroy:function(b){var d=this.v(),c="function"!=typeof b||a.C(b)?function(a){return a===b}:b;this.X();
for(var e=d.length-1;0<=e;e--)c(d[e])&&(d[e]._destroy=!0);this.W()},destroyAll:function(b){return b===p?this.destroy(function(){return!0}):b?this.destroy(function(d){return 0<=a.a.m(b,d)}):[]},indexOf:function(b){var d=this();return a.a.m(d,b)},replace:function(a,d){var c=this.indexOf(a);0<=c&&(this.X(),this.v()[c]=d,this.W())}};a.a.u("pop push reverse shift sort splice unshift".split(" "),function(b){a.aa.fn[b]=function(){var a=this.v();this.X();this.sb(a,b,arguments);a=a[b].apply(a,arguments);this.W();
return a}});a.a.u(["slice"],function(b){a.aa.fn[b]=function(){var a=this();return a[b].apply(a,arguments)}});a.a.xa&&a.a.za(a.aa.fn,a.p.fn);a.b("observableArray",a.aa);var J="arrayChange";a.La.trackArrayChanges=function(b){function d(){if(!c){c=!0;var d=b.notifySubscribers;b.notifySubscribers=function(a,b){b&&b!==G||++g;return d.apply(this,arguments)};var f=[].concat(b.v()||[]);e=null;b.U(function(c){c=[].concat(c||[]);if(b.Ab(J)){var d;if(!e||1<g)e=a.a.Fa(f,c,{sparse:!0});d=e;d.length&&b.notifySubscribers(d,
J)}f=c;e=null;g=0})}}if(!b.sb){var c=!1,e=null,g=0,h=b.U;b.U=b.subscribe=function(a,b,c){c===J&&d();return h.apply(this,arguments)};b.sb=function(b,d,m){function l(a,b,c){return q[q.length]={status:a,value:b,index:c}}if(c&&!g){var q=[],h=b.length,t=m.length,z=0;switch(d){case "push":z=h;case "unshift":for(d=0;d<t;d++)l("added",m[d],z+d);break;case "pop":z=h-1;case "shift":h&&l("deleted",b[z],z);break;case "splice":d=Math.min(Math.max(0,0>m[0]?h+m[0]:m[0]),h);for(var h=1===t?h:Math.min(d+(m[1]||0),
h),t=d+t-2,z=Math.max(h,t),u=[],r=[],E=2;d<z;++d,++E)d<h&&r.push(l("deleted",b[d],d)),d<t&&u.push(l("added",m[E],d));a.a.wb(r,u);break;default:return}e=q}}}};a.s=a.j=function(b,d,c){function e(){a.a.G(v,function(a,b){b.K()});v={}}function g(){e();C=0;u=!0;n=!1}function h(){var a=f.throttleEvaluation;a&&0<=a?(clearTimeout(P),P=setTimeout(k,a)):f.ib?f.ib():k()}function k(b){if(t){if(E)throw Error("A 'pure' computed must not be called recursively");}else if(!u){if(w&&w()){if(!z){s();return}}else z=!1;
t=!0;if(y)try{var c={};a.k.Ea({wa:function(a,b){c[b]||(c[b]=1,++C)},s:f,ma:p});C=0;q=r.call(d)}finally{a.k.end(),t=!1}else try{var e=v,m=C;a.k.Ea({wa:function(a,b){u||(m&&e[b]?(v[b]=e[b],++C,delete e[b],--m):v[b]||(v[b]=a.U(h),++C))},s:f,ma:E?p:!C});v={};C=0;try{var l=d?r.call(d):r()}finally{a.k.end(),m&&a.a.G(e,function(a,b){b.K()}),n=!1}f.Pa(q,l)&&(f.notifySubscribers(q,"beforeChange"),q=l,!0!==b&&f.notifySubscribers(q))}finally{t=!1}C||s()}}function f(){if(0<arguments.length){if("function"===typeof O)O.apply(d,
arguments);else throw Error("Cannot write a value to a ko.computed unless you specify a 'write' option. If you wish to read the current value, don't pass any parameters.");return this}a.k.Jb(f);n&&k(!0);return q}function m(){n&&!C&&k(!0);return q}function l(){return n||0<C}var q,n=!0,t=!1,z=!1,u=!1,r=b,E=!1,y=!1;r&&"object"==typeof r?(c=r,r=c.read):(c=c||{},r||(r=c.read));if("function"!=typeof r)throw Error("Pass a function that returns the value of the ko.computed");var O=c.write,x=c.disposeWhenNodeIsRemoved||
c.o||null,B=c.disposeWhen||c.Ia,w=B,s=g,v={},C=0,P=null;d||(d=c.owner);a.P.call(f);a.a.Aa(f,a.j.fn);f.v=m;f.la=function(){return C};f.hc="function"===typeof c.write;f.K=function(){s()};f.Z=l;var A=f.Ta;f.Ta=function(a){A.call(f,a);f.ib=function(){f.kb(q);n=!0;f.lb(f)}};c.pure?(y=E=!0,f.va=function(){y&&(y=!1,k(!0))},f.nb=function(){f.yb()||(e(),y=n=!0)}):c.deferEvaluation&&(f.va=function(){m();delete f.va});a.A(f,"peek",f.v);a.A(f,"dispose",f.K);a.A(f,"isActive",f.Z);a.A(f,"getDependenciesCount",
f.la);x&&(z=!0,x.nodeType&&(w=function(){return!a.a.Ja(x)||B&&B()}));y||c.deferEvaluation||k();x&&l()&&x.nodeType&&(s=function(){a.a.w.Kb(x,s);g()},a.a.w.da(x,s));return f};a.jc=function(b){return a.Ma(b,a.j)};A=a.p.rc;a.j[A]=a.p;a.j.fn={equalityComparer:H};a.j.fn[A]=a.j;a.a.xa&&a.a.za(a.j.fn,a.P.fn);a.b("dependentObservable",a.j);a.b("computed",a.j);a.b("isComputed",a.jc);a.Ib=function(b,d){if("function"===typeof b)return a.s(b,d,{pure:!0});b=a.a.extend({},b);b.pure=!0;return a.s(b,d)};a.b("pureComputed",
a.Ib);(function(){function b(a,g,h){h=h||new c;a=g(a);if("object"!=typeof a||null===a||a===p||a instanceof Date||a instanceof String||a instanceof Number||a instanceof Boolean)return a;var k=a instanceof Array?[]:{};h.save(a,k);d(a,function(c){var d=g(a[c]);switch(typeof d){case "boolean":case "number":case "string":case "function":k[c]=d;break;case "object":case "undefined":var l=h.get(d);k[c]=l!==p?l:b(d,g,h)}});return k}function d(a,b){if(a instanceof Array){for(var c=0;c<a.length;c++)b(c);"function"==
typeof a.toJSON&&b("toJSON")}else for(c in a)b(c)}function c(){this.keys=[];this.hb=[]}a.Qb=function(c){if(0==arguments.length)throw Error("When calling ko.toJS, pass the object you want to convert.");return b(c,function(b){for(var c=0;a.C(b)&&10>c;c++)b=b();return b})};a.toJSON=function(b,c,d){b=a.Qb(b);return a.a.eb(b,c,d)};c.prototype={save:function(b,c){var d=a.a.m(this.keys,b);0<=d?this.hb[d]=c:(this.keys.push(b),this.hb.push(c))},get:function(b){b=a.a.m(this.keys,b);return 0<=b?this.hb[b]:p}}})();
a.b("toJS",a.Qb);a.b("toJSON",a.toJSON);(function(){a.i={q:function(b){switch(a.a.t(b)){case "option":return!0===b.__ko__hasDomDataOptionValue__?a.a.e.get(b,a.d.options.Va):7>=a.a.L?b.getAttributeNode("value")&&b.getAttributeNode("value").specified?b.value:b.text:b.value;case "select":return 0<=b.selectedIndex?a.i.q(b.options[b.selectedIndex]):p;default:return b.value}},ca:function(b,d,c){switch(a.a.t(b)){case "option":switch(typeof d){case "string":a.a.e.set(b,a.d.options.Va,p);"__ko__hasDomDataOptionValue__"in
b&&delete b.__ko__hasDomDataOptionValue__;b.value=d;break;default:a.a.e.set(b,a.d.options.Va,d),b.__ko__hasDomDataOptionValue__=!0,b.value="number"===typeof d?d:""}break;case "select":if(""===d||null===d)d=p;for(var e=-1,g=0,h=b.options.length,k;g<h;++g)if(k=a.i.q(b.options[g]),k==d||""==k&&d===p){e=g;break}if(c||0<=e||d===p&&1<b.size)b.selectedIndex=e;break;default:if(null===d||d===p)d="";b.value=d}}}})();a.b("selectExtensions",a.i);a.b("selectExtensions.readValue",a.i.q);a.b("selectExtensions.writeValue",
a.i.ca);a.h=function(){function b(b){b=a.a.cb(b);123===b.charCodeAt(0)&&(b=b.slice(1,-1));var c=[],d=b.match(e),k,n,t=0;if(d){d.push(",");for(var z=0,u;u=d[z];++z){var r=u.charCodeAt(0);if(44===r){if(0>=t){k&&c.push(n?{key:k,value:n.join("")}:{unknown:k});k=n=t=0;continue}}else if(58===r){if(!n)continue}else if(47===r&&z&&1<u.length)(r=d[z-1].match(g))&&!h[r[0]]&&(b=b.substr(b.indexOf(u)+1),d=b.match(e),d.push(","),z=-1,u="/");else if(40===r||123===r||91===r)++t;else if(41===r||125===r||93===r)--t;
else if(!k&&!n){k=34===r||39===r?u.slice(1,-1):u;continue}n?n.push(u):n=[u]}}return c}var d=["true","false","null","undefined"],c=/^(?:[$_a-z][$\w]*|(.+)(\.\s*[$_a-z][$\w]*|\[.+\]))$/i,e=RegExp("\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|/(?:[^/\\\\]|\\\\.)*/w*|[^\\s:,/][^,\"'{}()/:[\\]]*[^\\s,\"'{}()/:[\\]]|[^\\s]","g"),g=/[\])"'A-Za-z0-9_$]+$/,h={"in":1,"return":1,"typeof":1},k={};return{ha:[],V:k,Wa:b,ya:function(f,m){function e(b,m){var f;if(!z){var u=a.getBindingHandler(b);if(u&&u.preprocess&&
!(m=u.preprocess(m,b,e)))return;if(u=k[b])f=m,0<=a.a.m(d,f)?f=!1:(u=f.match(c),f=null===u?!1:u[1]?"Object("+u[1]+")"+u[2]:f),u=f;u&&h.push("'"+b+"':function(_z){"+f+"=_z}")}t&&(m="function(){return "+m+" }");g.push("'"+b+"':"+m)}m=m||{};var g=[],h=[],t=m.valueAccessors,z=m.bindingParams,u="string"===typeof f?b(f):f;a.a.u(u,function(a){e(a.key||a.unknown,a.value)});h.length&&e("_ko_property_writers","{"+h.join(",")+" }");return g.join(",")},lc:function(a,b){for(var c=0;c<a.length;c++)if(a[c].key==
b)return!0;return!1},pa:function(b,c,d,e,k){if(b&&a.C(b))!a.Ra(b)||k&&b.v()===e||b(e);else if((b=c.get("_ko_property_writers"))&&b[d])b[d](e)}}}();a.b("expressionRewriting",a.h);a.b("expressionRewriting.bindingRewriteValidators",a.h.ha);a.b("expressionRewriting.parseObjectLiteral",a.h.Wa);a.b("expressionRewriting.preProcessBindings",a.h.ya);a.b("expressionRewriting._twoWayBindings",a.h.V);a.b("jsonExpressionRewriting",a.h);a.b("jsonExpressionRewriting.insertPropertyAccessorsIntoJson",a.h.ya);(function(){function b(a){return 8==
a.nodeType&&h.test(g?a.text:a.nodeValue)}function d(a){return 8==a.nodeType&&k.test(g?a.text:a.nodeValue)}function c(a,c){for(var f=a,e=1,k=[];f=f.nextSibling;){if(d(f)&&(e--,0===e))return k;k.push(f);b(f)&&e++}if(!c)throw Error("Cannot find closing comment tag to match: "+a.nodeValue);return null}function e(a,b){var d=c(a,b);return d?0<d.length?d[d.length-1].nextSibling:a.nextSibling:null}var g=v&&"\x3c!--test--\x3e"===v.createComment("test").text,h=g?/^\x3c!--\s*ko(?:\s+([\s\S]+))?\s*--\x3e$/:/^\s*ko(?:\s+([\s\S]+))?\s*$/,
k=g?/^\x3c!--\s*\/ko\s*--\x3e$/:/^\s*\/ko\s*$/,f={ul:!0,ol:!0};a.f={Q:{},childNodes:function(a){return b(a)?c(a):a.childNodes},ja:function(c){if(b(c)){c=a.f.childNodes(c);for(var d=0,f=c.length;d<f;d++)a.removeNode(c[d])}else a.a.Ka(c)},T:function(c,d){if(b(c)){a.f.ja(c);for(var f=c.nextSibling,e=0,k=d.length;e<k;e++)f.parentNode.insertBefore(d[e],f)}else a.a.T(c,d)},Hb:function(a,c){b(a)?a.parentNode.insertBefore(c,a.nextSibling):a.firstChild?a.insertBefore(c,a.firstChild):a.appendChild(c)},Bb:function(c,
d,f){f?b(c)?c.parentNode.insertBefore(d,f.nextSibling):f.nextSibling?c.insertBefore(d,f.nextSibling):c.appendChild(d):a.f.Hb(c,d)},firstChild:function(a){return b(a)?!a.nextSibling||d(a.nextSibling)?null:a.nextSibling:a.firstChild},nextSibling:function(a){b(a)&&(a=e(a));return a.nextSibling&&d(a.nextSibling)?null:a.nextSibling},gc:b,xc:function(a){return(a=(g?a.text:a.nodeValue).match(h))?a[1]:null},Fb:function(c){if(f[a.a.t(c)]){var k=c.firstChild;if(k){do if(1===k.nodeType){var g;g=k.firstChild;
var h=null;if(g){do if(h)h.push(g);else if(b(g)){var t=e(g,!0);t?g=t:h=[g]}else d(g)&&(h=[g]);while(g=g.nextSibling)}if(g=h)for(h=k.nextSibling,t=0;t<g.length;t++)h?c.insertBefore(g[t],h):c.appendChild(g[t])}while(k=k.nextSibling)}}}}})();a.b("virtualElements",a.f);a.b("virtualElements.allowedBindings",a.f.Q);a.b("virtualElements.emptyNode",a.f.ja);a.b("virtualElements.insertAfter",a.f.Bb);a.b("virtualElements.prepend",a.f.Hb);a.b("virtualElements.setDomNodeChildren",a.f.T);(function(){a.J=function(){this.Yb=
{}};a.a.extend(a.J.prototype,{nodeHasBindings:function(b){switch(b.nodeType){case 1:return null!=b.getAttribute("data-bind")||a.g.getComponentNameForNode(b);case 8:return a.f.gc(b);default:return!1}},getBindings:function(b,d){var c=this.getBindingsString(b,d),c=c?this.parseBindingsString(c,d,b):null;return a.g.mb(c,b,d,!1)},getBindingAccessors:function(b,d){var c=this.getBindingsString(b,d),c=c?this.parseBindingsString(c,d,b,{valueAccessors:!0}):null;return a.g.mb(c,b,d,!0)},getBindingsString:function(b){switch(b.nodeType){case 1:return b.getAttribute("data-bind");
case 8:return a.f.xc(b);default:return null}},parseBindingsString:function(b,d,c,e){try{var g=this.Yb,h=b+(e&&e.valueAccessors||""),k;if(!(k=g[h])){var f,m="with($context){with($data||{}){return{"+a.h.ya(b,e)+"}}}";f=new Function("$context","$element",m);k=g[h]=f}return k(d,c)}catch(l){throw l.message="Unable to parse bindings.\nBindings value: "+b+"\nMessage: "+l.message,l;}}});a.J.instance=new a.J})();a.b("bindingProvider",a.J);(function(){function b(a){return function(){return a}}function d(a){return a()}
function c(b){return a.a.na(a.k.B(b),function(a,c){return function(){return b()[c]}})}function e(a,b){return c(this.getBindings.bind(this,a,b))}function g(b,c,d){var f,e=a.f.firstChild(c),k=a.J.instance,g=k.preprocessNode;if(g){for(;f=e;)e=a.f.nextSibling(f),g.call(k,f);e=a.f.firstChild(c)}for(;f=e;)e=a.f.nextSibling(f),h(b,f,d)}function h(b,c,d){var e=!0,k=1===c.nodeType;k&&a.f.Fb(c);if(k&&d||a.J.instance.nodeHasBindings(c))e=f(c,null,b,d).shouldBindDescendants;e&&!l[a.a.t(c)]&&g(b,c,!k)}function k(b){var c=
[],d={},f=[];a.a.G(b,function y(e){if(!d[e]){var k=a.getBindingHandler(e);k&&(k.after&&(f.push(e),a.a.u(k.after,function(c){if(b[c]){if(-1!==a.a.m(f,c))throw Error("Cannot combine the following bindings, because they have a cyclic dependency: "+f.join(", "));y(c)}}),f.length--),c.push({key:e,zb:k}));d[e]=!0}});return c}function f(b,c,f,g){var m=a.a.e.get(b,q);if(!c){if(m)throw Error("You cannot apply bindings multiple times to the same element.");a.a.e.set(b,q,!0)}!m&&g&&a.Ob(b,f);var l;if(c&&"function"!==
typeof c)l=c;else{var h=a.J.instance,n=h.getBindingAccessors||e,s=a.j(function(){(l=c?c(f,b):n.call(h,b,f))&&f.I&&f.I();return l},null,{o:b});l&&s.Z()||(s=null)}var v;if(l){var w=s?function(a){return function(){return d(s()[a])}}:function(a){return l[a]},A=function(){return a.a.na(s?s():l,d)};A.get=function(a){return l[a]&&d(w(a))};A.has=function(a){return a in l};g=k(l);a.a.u(g,function(c){var d=c.zb.init,e=c.zb.update,k=c.key;if(8===b.nodeType&&!a.f.Q[k])throw Error("The binding '"+k+"' cannot be used with virtual elements");
try{"function"==typeof d&&a.k.B(function(){var a=d(b,w(k),A,f.$data,f);if(a&&a.controlsDescendantBindings){if(v!==p)throw Error("Multiple bindings ("+v+" and "+k+") are trying to control descendant bindings of the same element. You cannot use these bindings together on the same element.");v=k}}),"function"==typeof e&&a.j(function(){e(b,w(k),A,f.$data,f)},null,{o:b})}catch(g){throw g.message='Unable to process binding "'+k+": "+l[k]+'"\nMessage: '+g.message,g;}})}return{shouldBindDescendants:v===p}}
function m(b){return b&&b instanceof a.N?b:new a.N(b)}a.d={};var l={script:!0};a.getBindingHandler=function(b){return a.d[b]};a.N=function(b,c,d,f){var e=this,k="function"==typeof b&&!a.C(b),g,m=a.j(function(){var g=k?b():b,l=a.a.c(g);c?(c.I&&c.I(),a.a.extend(e,c),m&&(e.I=m)):(e.$parents=[],e.$root=l,e.ko=a);e.$rawData=g;e.$data=l;d&&(e[d]=l);f&&f(e,c,l);return e.$data},null,{Ia:function(){return g&&!a.a.ob(g)},o:!0});m.Z()&&(e.I=m,m.equalityComparer=null,g=[],m.Tb=function(b){g.push(b);a.a.w.da(b,
function(b){a.a.ua(g,b);g.length||(m.K(),e.I=m=p)})})};a.N.prototype.createChildContext=function(b,c,d){return new a.N(b,this,c,function(a,b){a.$parentContext=b;a.$parent=b.$data;a.$parents=(b.$parents||[]).slice(0);a.$parents.unshift(a.$parent);d&&d(a)})};a.N.prototype.extend=function(b){return new a.N(this.I||this.$data,this,null,function(c,d){c.$rawData=d.$rawData;a.a.extend(c,"function"==typeof b?b():b)})};var q=a.a.e.F(),n=a.a.e.F();a.Ob=function(b,c){if(2==arguments.length)a.a.e.set(b,n,c),
c.I&&c.I.Tb(b);else return a.a.e.get(b,n)};a.ra=function(b,c,d){1===b.nodeType&&a.f.Fb(b);return f(b,c,m(d),!0)};a.Wb=function(d,f,e){e=m(e);return a.ra(d,"function"===typeof f?c(f.bind(null,e,d)):a.a.na(f,b),e)};a.Ca=function(a,b){1!==b.nodeType&&8!==b.nodeType||g(m(a),b,!0)};a.pb=function(a,b){!w&&s.jQuery&&(w=s.jQuery);if(b&&1!==b.nodeType&&8!==b.nodeType)throw Error("ko.applyBindings: first parameter should be your view model; second parameter should be a DOM node");b=b||s.document.body;h(m(a),
b,!0)};a.Ha=function(b){switch(b.nodeType){case 1:case 8:var c=a.Ob(b);if(c)return c;if(b.parentNode)return a.Ha(b.parentNode)}return p};a.$b=function(b){return(b=a.Ha(b))?b.$data:p};a.b("bindingHandlers",a.d);a.b("applyBindings",a.pb);a.b("applyBindingsToDescendants",a.Ca);a.b("applyBindingAccessorsToNode",a.ra);a.b("applyBindingsToNode",a.Wb);a.b("contextFor",a.Ha);a.b("dataFor",a.$b)})();(function(b){function d(d,f){var e=g.hasOwnProperty(d)?g[d]:b,l;e||(e=g[d]=new a.P,c(d,function(a){h[d]=a;delete g[d];
l?e.notifySubscribers(a):setTimeout(function(){e.notifySubscribers(a)},0)}),l=!0);e.U(f)}function c(a,b){e("getConfig",[a],function(c){c?e("loadComponent",[a,c],function(a){b(a)}):b(null)})}function e(c,d,g,l){l||(l=a.g.loaders.slice(0));var h=l.shift();if(h){var n=h[c];if(n){var t=!1;if(n.apply(h,d.concat(function(a){t?g(null):null!==a?g(a):e(c,d,g,l)}))!==b&&(t=!0,!h.suppressLoaderExceptions))throw Error("Component loaders must supply values by invoking the callback, not by returning values synchronously.");
}else e(c,d,g,l)}else g(null)}var g={},h={};a.g={get:function(a,c){var e=h.hasOwnProperty(a)?h[a]:b;e?setTimeout(function(){c(e)},0):d(a,c)},tb:function(a){delete h[a]},jb:e};a.g.loaders=[];a.b("components",a.g);a.b("components.get",a.g.get);a.b("components.clearCachedDefinition",a.g.tb)})();(function(){function b(b,c,d,e){function k(){0===--u&&e(h)}var h={},u=2,r=d.template;d=d.viewModel;r?g(c,r,function(c){a.g.jb("loadTemplate",[b,c],function(a){h.template=a;k()})}):k();d?g(c,d,function(c){a.g.jb("loadViewModel",
[b,c],function(a){h[f]=a;k()})}):k()}function d(a,b,c){if("function"===typeof b)c(function(a){return new b(a)});else if("function"===typeof b[f])c(b[f]);else if("instance"in b){var e=b.instance;c(function(){return e})}else"viewModel"in b?d(a,b.viewModel,c):a("Unknown viewModel value: "+b)}function c(b){switch(a.a.t(b)){case "script":return a.a.ba(b.text);case "textarea":return a.a.ba(b.value);case "template":if(e(b.content))return a.a.ia(b.content.childNodes)}return a.a.ia(b.childNodes)}function e(a){return s.DocumentFragment?
a instanceof DocumentFragment:a&&11===a.nodeType}function g(a,b,c){"string"===typeof b.require?N||s.require?(N||s.require)([b.require],c):a("Uses require, but no AMD loader is present"):c(b)}function h(a){return function(b){throw Error("Component '"+a+"': "+b);}}var k={};a.g.tc=function(b,c){if(!c)throw Error("Invalid configuration for "+b);if(a.g.Qa(b))throw Error("Component "+b+" is already registered");k[b]=c};a.g.Qa=function(a){return a in k};a.g.wc=function(b){delete k[b];a.g.tb(b)};a.g.ub={getConfig:function(a,
b){b(k.hasOwnProperty(a)?k[a]:null)},loadComponent:function(a,c,d){var e=h(a);g(e,c,function(c){b(a,e,c,d)})},loadTemplate:function(b,d,f){b=h(b);if("string"===typeof d)f(a.a.ba(d));else if(d instanceof Array)f(d);else if(e(d))f(a.a.S(d.childNodes));else if(d.element)if(d=d.element,s.HTMLElement?d instanceof HTMLElement:d&&d.tagName&&1===d.nodeType)f(c(d));else if("string"===typeof d){var k=v.getElementById(d);k?f(c(k)):b("Cannot find element with ID "+d)}else b("Unknown element type: "+d);else b("Unknown template value: "+
d)},loadViewModel:function(a,b,c){d(h(a),b,c)}};var f="createViewModel";a.b("components.register",a.g.tc);a.b("components.isRegistered",a.g.Qa);a.b("components.unregister",a.g.wc);a.b("components.defaultLoader",a.g.ub);a.g.loaders.push(a.g.ub);a.g.Ub=k})();(function(){function b(b,e){var g=b.getAttribute("params");if(g){var g=d.parseBindingsString(g,e,b,{valueAccessors:!0,bindingParams:!0}),g=a.a.na(g,function(d){return a.s(d,null,{o:b})}),h=a.a.na(g,function(d){return d.Z()?a.s(function(){return a.a.c(d())},
null,{o:b}):d.v()});h.hasOwnProperty("$raw")||(h.$raw=g);return h}return{$raw:{}}}a.g.getComponentNameForNode=function(b){b=a.a.t(b);return a.g.Qa(b)&&b};a.g.mb=function(c,d,g,h){if(1===d.nodeType){var k=a.g.getComponentNameForNode(d);if(k){c=c||{};if(c.component)throw Error('Cannot use the "component" binding on a custom element matching a component');var f={name:k,params:b(d,g)};c.component=h?function(){return f}:f}}return c};var d=new a.J;9>a.a.L&&(a.g.register=function(a){return function(b){v.createElement(b);
return a.apply(this,arguments)}}(a.g.register),v.createDocumentFragment=function(b){return function(){var d=b(),g=a.g.Ub,h;for(h in g)g.hasOwnProperty(h)&&d.createElement(h);return d}}(v.createDocumentFragment))})();(function(){var b=0;a.d.component={init:function(d,c,e,g,h){function k(){var a=f&&f.dispose;"function"===typeof a&&a.call(f);m=null}var f,m;a.a.w.da(d,k);a.s(function(){var e=a.a.c(c()),g,n;"string"===typeof e?g=e:(g=a.a.c(e.name),n=a.a.c(e.params));if(!g)throw Error("No component name specified");
var t=m=++b;a.g.get(g,function(b){if(m===t){k();if(!b)throw Error("Unknown component '"+g+"'");var c=b.template;if(!c)throw Error("Component '"+g+"' has no template");c=a.a.ia(c);a.f.T(d,c);var c=n,e=b.createViewModel;b=e?e.call(b,c,{element:d}):c;c=h.createChildContext(b);f=b;a.Ca(c,d)}})},null,{o:d});return{controlsDescendantBindings:!0}}};a.f.Q.component=!0})();var Q={"class":"className","for":"htmlFor"};a.d.attr={update:function(b,d){var c=a.a.c(d())||{};a.a.G(c,function(c,d){d=a.a.c(d);var h=
!1===d||null===d||d===p;h&&b.removeAttribute(c);8>=a.a.L&&c in Q?(c=Q[c],h?b.removeAttribute(c):b[c]=d):h||b.setAttribute(c,d.toString());"name"===c&&a.a.Mb(b,h?"":d.toString())})}};(function(){a.d.checked={after:["value","attr"],init:function(b,d,c){function e(){var e=b.checked,k=q?h():e;if(!a.Y.ma()&&(!f||e)){var g=a.k.B(d);m?l!==k?(e&&(a.a.ea(g,k,!0),a.a.ea(g,l,!1)),l=k):a.a.ea(g,k,e):a.h.pa(g,c,"checked",k,!0)}}function g(){var c=a.a.c(d());b.checked=m?0<=a.a.m(c,h()):k?c:h()===c}var h=a.Ib(function(){return c.has("checkedValue")?
a.a.c(c.get("checkedValue")):c.has("value")?a.a.c(c.get("value")):b.value}),k="checkbox"==b.type,f="radio"==b.type;if(k||f){var m=k&&a.a.c(d())instanceof Array,l=m?h():p,q=f||m;f&&!b.name&&a.d.uniqueName.init(b,function(){return!0});a.s(e,null,{o:b});a.a.n(b,"click",e);a.s(g,null,{o:b})}}};a.h.V.checked=!0;a.d.checkedValue={update:function(b,d){b.value=a.a.c(d())}}})();a.d.css={update:function(b,d){var c=a.a.c(d());"object"==typeof c?a.a.G(c,function(c,d){d=a.a.c(d);a.a.Ba(b,c,d)}):(c=String(c||""),
a.a.Ba(b,b.__ko__cssValue,!1),b.__ko__cssValue=c,a.a.Ba(b,c,!0))}};a.d.enable={update:function(b,d){var c=a.a.c(d());c&&b.disabled?b.removeAttribute("disabled"):c||b.disabled||(b.disabled=!0)}};a.d.disable={update:function(b,d){a.d.enable.update(b,function(){return!a.a.c(d())})}};a.d.event={init:function(b,d,c,e,g){var h=d()||{};a.a.G(h,function(k){"string"==typeof k&&a.a.n(b,k,function(b){var h,l=d()[k];if(l){try{var q=a.a.S(arguments);e=g.$data;q.unshift(e);h=l.apply(e,q)}finally{!0!==h&&(b.preventDefault?
b.preventDefault():b.returnValue=!1)}!1===c.get(k+"Bubble")&&(b.cancelBubble=!0,b.stopPropagation&&b.stopPropagation())}})})}};a.d.foreach={Eb:function(b){return function(){var d=b(),c=a.a.Xa(d);if(!c||"number"==typeof c.length)return{foreach:d,templateEngine:a.O.Oa};a.a.c(d);return{foreach:c.data,as:c.as,includeDestroyed:c.includeDestroyed,afterAdd:c.afterAdd,beforeRemove:c.beforeRemove,afterRender:c.afterRender,beforeMove:c.beforeMove,afterMove:c.afterMove,templateEngine:a.O.Oa}}},init:function(b,
d){return a.d.template.init(b,a.d.foreach.Eb(d))},update:function(b,d,c,e,g){return a.d.template.update(b,a.d.foreach.Eb(d),c,e,g)}};a.h.ha.foreach=!1;a.f.Q.foreach=!0;a.d.hasfocus={init:function(b,d,c){function e(e){b.__ko_hasfocusUpdating=!0;var f=b.ownerDocument;if("activeElement"in f){var g;try{g=f.activeElement}catch(h){g=f.body}e=g===b}f=d();a.h.pa(f,c,"hasfocus",e,!0);b.__ko_hasfocusLastValue=e;b.__ko_hasfocusUpdating=!1}var g=e.bind(null,!0),h=e.bind(null,!1);a.a.n(b,"focus",g);a.a.n(b,"focusin",
g);a.a.n(b,"blur",h);a.a.n(b,"focusout",h)},update:function(b,d){var c=!!a.a.c(d());b.__ko_hasfocusUpdating||b.__ko_hasfocusLastValue===c||(c?b.focus():b.blur(),a.k.B(a.a.oa,null,[b,c?"focusin":"focusout"]))}};a.h.V.hasfocus=!0;a.d.hasFocus=a.d.hasfocus;a.h.V.hasFocus=!0;a.d.html={init:function(){return{controlsDescendantBindings:!0}},update:function(b,d){a.a.$a(b,d())}};I("if");I("ifnot",!1,!0);I("with",!0,!1,function(a,d){return a.createChildContext(d)});var K={};a.d.options={init:function(b){if("select"!==
a.a.t(b))throw Error("options binding applies only to SELECT elements");for(;0<b.length;)b.remove(0);return{controlsDescendantBindings:!0}},update:function(b,d,c){function e(){return a.a.ta(b.options,function(a){return a.selected})}function g(a,b,c){var d=typeof b;return"function"==d?b(a):"string"==d?a[b]:c}function h(c,d){if(q.length){var e=0<=a.a.m(q,a.i.q(d[0]));a.a.Nb(d[0],e);n&&!e&&a.k.B(a.a.oa,null,[b,"change"])}}var k=0!=b.length&&b.multiple?b.scrollTop:null,f=a.a.c(d()),m=c.get("optionsIncludeDestroyed");
d={};var l,q;q=b.multiple?a.a.Da(e(),a.i.q):0<=b.selectedIndex?[a.i.q(b.options[b.selectedIndex])]:[];f&&("undefined"==typeof f.length&&(f=[f]),l=a.a.ta(f,function(b){return m||b===p||null===b||!a.a.c(b._destroy)}),c.has("optionsCaption")&&(f=a.a.c(c.get("optionsCaption")),null!==f&&f!==p&&l.unshift(K)));var n=!1;d.beforeRemove=function(a){b.removeChild(a)};f=h;c.has("optionsAfterRender")&&(f=function(b,d){h(0,d);a.k.B(c.get("optionsAfterRender"),null,[d[0],b!==K?b:p])});a.a.Za(b,l,function(d,e,f){f.length&&
(q=f[0].selected?[a.i.q(f[0])]:[],n=!0);e=b.ownerDocument.createElement("option");d===K?(a.a.bb(e,c.get("optionsCaption")),a.i.ca(e,p)):(f=g(d,c.get("optionsValue"),d),a.i.ca(e,a.a.c(f)),d=g(d,c.get("optionsText"),f),a.a.bb(e,d));return[e]},d,f);a.k.B(function(){c.get("valueAllowUnset")&&c.has("value")?a.i.ca(b,a.a.c(c.get("value")),!0):(b.multiple?q.length&&e().length<q.length:q.length&&0<=b.selectedIndex?a.i.q(b.options[b.selectedIndex])!==q[0]:q.length||0<=b.selectedIndex)&&a.a.oa(b,"change")});
a.a.dc(b);k&&20<Math.abs(k-b.scrollTop)&&(b.scrollTop=k)}};a.d.options.Va=a.a.e.F();a.d.selectedOptions={after:["options","foreach"],init:function(b,d,c){a.a.n(b,"change",function(){var e=d(),g=[];a.a.u(b.getElementsByTagName("option"),function(b){b.selected&&g.push(a.i.q(b))});a.h.pa(e,c,"selectedOptions",g)})},update:function(b,d){if("select"!=a.a.t(b))throw Error("values binding applies only to SELECT elements");var c=a.a.c(d());c&&"number"==typeof c.length&&a.a.u(b.getElementsByTagName("option"),
function(b){var d=0<=a.a.m(c,a.i.q(b));a.a.Nb(b,d)})}};a.h.V.selectedOptions=!0;a.d.style={update:function(b,d){var c=a.a.c(d()||{});a.a.G(c,function(c,d){d=a.a.c(d);if(null===d||d===p||!1===d)d="";b.style[c]=d})}};a.d.submit={init:function(b,d,c,e,g){if("function"!=typeof d())throw Error("The value for a submit binding must be a function");a.a.n(b,"submit",function(a){var c,e=d();try{c=e.call(g.$data,b)}finally{!0!==c&&(a.preventDefault?a.preventDefault():a.returnValue=!1)}})}};a.d.text={init:function(){return{controlsDescendantBindings:!0}},
update:function(b,d){a.a.bb(b,d())}};a.f.Q.text=!0;(function(){if(s&&s.navigator)var b=function(a){if(a)return parseFloat(a[1])},d=s.opera&&s.opera.version&&parseInt(s.opera.version()),c=s.navigator.userAgent,e=b(c.match(/^(?:(?!chrome).)*version\/([^ ]*) safari/i)),g=b(c.match(/Firefox\/([^ ]*)/));if(10>a.a.L)var h=a.a.e.F(),k=a.a.e.F(),f=function(b){var c=this.activeElement;(c=c&&a.a.e.get(c,k))&&c(b)},m=function(b,c){var d=b.ownerDocument;a.a.e.get(d,h)||(a.a.e.set(d,h,!0),a.a.n(d,"selectionchange",
f));a.a.e.set(b,k,c)};a.d.textInput={init:function(b,c,f){function k(c,d){a.a.n(b,c,d)}function h(){var d=a.a.c(c());if(null===d||d===p)d="";v!==p&&d===v?setTimeout(h,4):b.value!==d&&(s=d,b.value=d)}function u(){y||(v=b.value,y=setTimeout(r,4))}function r(){clearTimeout(y);v=y=p;var d=b.value;s!==d&&(s=d,a.h.pa(c(),f,"textInput",d))}var s=b.value,y,v;10>a.a.L?(k("propertychange",function(a){"value"===a.propertyName&&r()}),8==a.a.L&&(k("keyup",r),k("keydown",r)),8<=a.a.L&&(m(b,r),k("dragend",u))):
(k("input",r),5>e&&"textarea"===a.a.t(b)?(k("keydown",u),k("paste",u),k("cut",u)):11>d?k("keydown",u):4>g&&(k("DOMAutoComplete",r),k("dragdrop",r),k("drop",r)));k("change",r);a.s(h,null,{o:b})}};a.h.V.textInput=!0;a.d.textinput={preprocess:function(a,b,c){c("textInput",a)}}})();a.d.uniqueName={init:function(b,d){if(d()){var c="ko_unique_"+ ++a.d.uniqueName.Zb;a.a.Mb(b,c)}}};a.d.uniqueName.Zb=0;a.d.value={after:["options","foreach"],init:function(b,d,c){if("input"!=b.tagName.toLowerCase()||"checkbox"!=
b.type&&"radio"!=b.type){var e=["change"],g=c.get("valueUpdate"),h=!1,k=null;g&&("string"==typeof g&&(g=[g]),a.a.ga(e,g),e=a.a.rb(e));var f=function(){k=null;h=!1;var e=d(),f=a.i.q(b);a.h.pa(e,c,"value",f)};!a.a.L||"input"!=b.tagName.toLowerCase()||"text"!=b.type||"off"==b.autocomplete||b.form&&"off"==b.form.autocomplete||-1!=a.a.m(e,"propertychange")||(a.a.n(b,"propertychange",function(){h=!0}),a.a.n(b,"focus",function(){h=!1}),a.a.n(b,"blur",function(){h&&f()}));a.a.u(e,function(c){var d=f;a.a.vc(c,
"after")&&(d=function(){k=a.i.q(b);setTimeout(f,0)},c=c.substring(5));a.a.n(b,c,d)});var m=function(){var e=a.a.c(d()),f=a.i.q(b);if(null!==k&&e===k)setTimeout(m,0);else if(e!==f)if("select"===a.a.t(b)){var g=c.get("valueAllowUnset"),f=function(){a.i.ca(b,e,g)};f();g||e===a.i.q(b)?setTimeout(f,0):a.k.B(a.a.oa,null,[b,"change"])}else a.i.ca(b,e)};a.s(m,null,{o:b})}else a.ra(b,{checkedValue:d})},update:function(){}};a.h.V.value=!0;a.d.visible={update:function(b,d){var c=a.a.c(d()),e="none"!=b.style.display;
c&&!e?b.style.display="":!c&&e&&(b.style.display="none")}};(function(b){a.d[b]={init:function(d,c,e,g,h){return a.d.event.init.call(this,d,function(){var a={};a[b]=c();return a},e,g,h)}}})("click");a.H=function(){};a.H.prototype.renderTemplateSource=function(){throw Error("Override renderTemplateSource");};a.H.prototype.createJavaScriptEvaluatorBlock=function(){throw Error("Override createJavaScriptEvaluatorBlock");};a.H.prototype.makeTemplateSource=function(b,d){if("string"==typeof b){d=d||v;var c=
d.getElementById(b);if(!c)throw Error("Cannot find template with ID "+b);return new a.r.l(c)}if(1==b.nodeType||8==b.nodeType)return new a.r.fa(b);throw Error("Unknown template type: "+b);};a.H.prototype.renderTemplate=function(a,d,c,e){a=this.makeTemplateSource(a,e);return this.renderTemplateSource(a,d,c)};a.H.prototype.isTemplateRewritten=function(a,d){return!1===this.allowTemplateRewriting?!0:this.makeTemplateSource(a,d).data("isRewritten")};a.H.prototype.rewriteTemplate=function(a,d,c){a=this.makeTemplateSource(a,
c);d=d(a.text());a.text(d);a.data("isRewritten",!0)};a.b("templateEngine",a.H);a.fb=function(){function b(b,c,d,k){b=a.h.Wa(b);for(var f=a.h.ha,m=0;m<b.length;m++){var l=b[m].key;if(f.hasOwnProperty(l)){var q=f[l];if("function"===typeof q){if(l=q(b[m].value))throw Error(l);}else if(!q)throw Error("This template engine does not support the '"+l+"' binding within its templates");}}d="ko.__tr_ambtns(function($context,$element){return(function(){return{ "+a.h.ya(b,{valueAccessors:!0})+" } })()},'"+d.toLowerCase()+
"')";return k.createJavaScriptEvaluatorBlock(d)+c}var d=/(<([a-z]+\d*)(?:\s+(?!data-bind\s*=\s*)[a-z0-9\-]+(?:=(?:\"[^\"]*\"|\'[^\']*\'))?)*\s+)data-bind\s*=\s*(["'])([\s\S]*?)\3/gi,c=/\x3c!--\s*ko\b\s*([\s\S]*?)\s*--\x3e/g;return{ec:function(b,c,d){c.isTemplateRewritten(b,d)||c.rewriteTemplate(b,function(b){return a.fb.nc(b,c)},d)},nc:function(a,g){return a.replace(d,function(a,c,d,e,l){return b(l,c,d,g)}).replace(c,function(a,c){return b(c,"\x3c!-- ko --\x3e","#comment",g)})},Xb:function(b,c){return a.D.Ua(function(d,
k){var f=d.nextSibling;f&&f.nodeName.toLowerCase()===c&&a.ra(f,b,k)})}}}();a.b("__tr_ambtns",a.fb.Xb);(function(){a.r={};a.r.l=function(a){this.l=a};a.r.l.prototype.text=function(){var b=a.a.t(this.l),b="script"===b?"text":"textarea"===b?"value":"innerHTML";if(0==arguments.length)return this.l[b];var d=arguments[0];"innerHTML"===b?a.a.$a(this.l,d):this.l[b]=d};var b=a.a.e.F()+"_";a.r.l.prototype.data=function(c){if(1===arguments.length)return a.a.e.get(this.l,b+c);a.a.e.set(this.l,b+c,arguments[1])};
var d=a.a.e.F();a.r.fa=function(a){this.l=a};a.r.fa.prototype=new a.r.l;a.r.fa.prototype.text=function(){if(0==arguments.length){var b=a.a.e.get(this.l,d)||{};b.gb===p&&b.Ga&&(b.gb=b.Ga.innerHTML);return b.gb}a.a.e.set(this.l,d,{gb:arguments[0]})};a.r.l.prototype.nodes=function(){if(0==arguments.length)return(a.a.e.get(this.l,d)||{}).Ga;a.a.e.set(this.l,d,{Ga:arguments[0]})};a.b("templateSources",a.r);a.b("templateSources.domElement",a.r.l);a.b("templateSources.anonymousTemplate",a.r.fa)})();(function(){function b(b,
c,d){var e;for(c=a.f.nextSibling(c);b&&(e=b)!==c;)b=a.f.nextSibling(e),d(e,b)}function d(c,d){if(c.length){var e=c[0],g=c[c.length-1],h=e.parentNode,n=a.J.instance,t=n.preprocessNode;if(t){b(e,g,function(a,b){var c=a.previousSibling,d=t.call(n,a);d&&(a===e&&(e=d[0]||b),a===g&&(g=d[d.length-1]||c))});c.length=0;if(!e)return;e===g?c.push(e):(c.push(e,g),a.a.ka(c,h))}b(e,g,function(b){1!==b.nodeType&&8!==b.nodeType||a.pb(d,b)});b(e,g,function(b){1!==b.nodeType&&8!==b.nodeType||a.D.Sb(b,[d])});a.a.ka(c,
h)}}function c(a){return a.nodeType?a:0<a.length?a[0]:null}function e(b,e,h,l,q){q=q||{};var n=b&&c(b),n=n&&n.ownerDocument,t=q.templateEngine||g;a.fb.ec(h,t,n);h=t.renderTemplate(h,l,q,n);if("number"!=typeof h.length||0<h.length&&"number"!=typeof h[0].nodeType)throw Error("Template engine must return an array of DOM nodes");n=!1;switch(e){case "replaceChildren":a.f.T(b,h);n=!0;break;case "replaceNode":a.a.Lb(b,h);n=!0;break;case "ignoreTargetNode":break;default:throw Error("Unknown renderMode: "+
e);}n&&(d(h,l),q.afterRender&&a.k.B(q.afterRender,null,[h,l.$data]));return h}var g;a.ab=function(b){if(b!=p&&!(b instanceof a.H))throw Error("templateEngine must inherit from ko.templateEngine");g=b};a.Ya=function(b,d,h,l,q){h=h||{};if((h.templateEngine||g)==p)throw Error("Set a template engine before calling renderTemplate");q=q||"replaceChildren";if(l){var n=c(l);return a.j(function(){var g=d&&d instanceof a.N?d:new a.N(a.a.c(d)),p=a.C(b)?b():"function"===typeof b?b(g.$data,g):b,g=e(l,q,p,g,h);
"replaceNode"==q&&(l=g,n=c(l))},null,{Ia:function(){return!n||!a.a.Ja(n)},o:n&&"replaceNode"==q?n.parentNode:n})}return a.D.Ua(function(c){a.Ya(b,d,h,c,"replaceNode")})};a.uc=function(b,c,g,h,q){function n(a,b){d(b,s);g.afterRender&&g.afterRender(b,a)}function t(c,d){s=q.createChildContext(c,g.as,function(a){a.$index=d});var f=a.C(b)?b():"function"===typeof b?b(c,s):b;return e(null,"ignoreTargetNode",f,s,g)}var s;return a.j(function(){var b=a.a.c(c)||[];"undefined"==typeof b.length&&(b=[b]);b=a.a.ta(b,
function(b){return g.includeDestroyed||b===p||null===b||!a.a.c(b._destroy)});a.k.B(a.a.Za,null,[h,b,t,g,n])},null,{o:h})};var h=a.a.e.F();a.d.template={init:function(b,c){var d=a.a.c(c());"string"==typeof d||d.name?a.f.ja(b):(d=a.f.childNodes(b),d=a.a.oc(d),(new a.r.fa(b)).nodes(d));return{controlsDescendantBindings:!0}},update:function(b,c,d,e,g){var n=c(),t;c=a.a.c(n);d=!0;e=null;"string"==typeof c?c={}:(n=c.name,"if"in c&&(d=a.a.c(c["if"])),d&&"ifnot"in c&&(d=!a.a.c(c.ifnot)),t=a.a.c(c.data));
"foreach"in c?e=a.uc(n||b,d&&c.foreach||[],c,b,g):d?(g="data"in c?g.createChildContext(t,c.as):g,e=a.Ya(n||b,g,c,b)):a.f.ja(b);g=e;(t=a.a.e.get(b,h))&&"function"==typeof t.K&&t.K();a.a.e.set(b,h,g&&g.Z()?g:p)}};a.h.ha.template=function(b){b=a.h.Wa(b);return 1==b.length&&b[0].unknown||a.h.lc(b,"name")?null:"This template engine does not support anonymous templates nested within its templates"};a.f.Q.template=!0})();a.b("setTemplateEngine",a.ab);a.b("renderTemplate",a.Ya);a.a.wb=function(a,d,c){if(a.length&&
d.length){var e,g,h,k,f;for(e=g=0;(!c||e<c)&&(k=a[g]);++g){for(h=0;f=d[h];++h)if(k.value===f.value){k.moved=f.index;f.moved=k.index;d.splice(h,1);e=h=0;break}e+=h}}};a.a.Fa=function(){function b(b,c,e,g,h){var k=Math.min,f=Math.max,m=[],l,q=b.length,n,p=c.length,s=p-q||1,u=q+p+1,r,v,w;for(l=0;l<=q;l++)for(v=r,m.push(r=[]),w=k(p,l+s),n=f(0,l-1);n<=w;n++)r[n]=n?l?b[l-1]===c[n-1]?v[n-1]:k(v[n]||u,r[n-1]||u)+1:n+1:l+1;k=[];f=[];s=[];l=q;for(n=p;l||n;)p=m[l][n]-1,n&&p===m[l][n-1]?f.push(k[k.length]={status:e,
value:c[--n],index:n}):l&&p===m[l-1][n]?s.push(k[k.length]={status:g,value:b[--l],index:l}):(--n,--l,h.sparse||k.push({status:"retained",value:c[n]}));a.a.wb(f,s,10*q);return k.reverse()}return function(a,c,e){e="boolean"===typeof e?{dontLimitMoves:e}:e||{};a=a||[];c=c||[];return a.length<=c.length?b(a,c,"added","deleted",e):b(c,a,"deleted","added",e)}}();a.b("utils.compareArrays",a.a.Fa);(function(){function b(b,d,g,h,k){var f=[],m=a.j(function(){var l=d(g,k,a.a.ka(f,b))||[];0<f.length&&(a.a.Lb(f,
l),h&&a.k.B(h,null,[g,l,k]));f.length=0;a.a.ga(f,l)},null,{o:b,Ia:function(){return!a.a.ob(f)}});return{$:f,j:m.Z()?m:p}}var d=a.a.e.F();a.a.Za=function(c,e,g,h,k){function f(b,d){x=q[d];r!==d&&(A[b]=x);x.Na(r++);a.a.ka(x.$,c);s.push(x);w.push(x)}function m(b,c){if(b)for(var d=0,e=c.length;d<e;d++)c[d]&&a.a.u(c[d].$,function(a){b(a,d,c[d].sa)})}e=e||[];h=h||{};var l=a.a.e.get(c,d)===p,q=a.a.e.get(c,d)||[],n=a.a.Da(q,function(a){return a.sa}),t=a.a.Fa(n,e,h.dontLimitMoves),s=[],u=0,r=0,v=[],w=[];e=
[];for(var A=[],n=[],x,B=0,D,F;D=t[B];B++)switch(F=D.moved,D.status){case "deleted":F===p&&(x=q[u],x.j&&x.j.K(),v.push.apply(v,a.a.ka(x.$,c)),h.beforeRemove&&(e[B]=x,w.push(x)));u++;break;case "retained":f(B,u++);break;case "added":F!==p?f(B,F):(x={sa:D.value,Na:a.p(r++)},s.push(x),w.push(x),l||(n[B]=x))}m(h.beforeMove,A);a.a.u(v,h.beforeRemove?a.R:a.removeNode);for(var B=0,l=a.f.firstChild(c),G;x=w[B];B++){x.$||a.a.extend(x,b(c,g,x.sa,k,x.Na));for(u=0;t=x.$[u];l=t.nextSibling,G=t,u++)t!==l&&a.f.Bb(c,
t,G);!x.ic&&k&&(k(x.sa,x.$,x.Na),x.ic=!0)}m(h.beforeRemove,e);m(h.afterMove,A);m(h.afterAdd,n);a.a.e.set(c,d,s)}})();a.b("utils.setDomNodeChildrenFromArrayMapping",a.a.Za);a.O=function(){this.allowTemplateRewriting=!1};a.O.prototype=new a.H;a.O.prototype.renderTemplateSource=function(b){var d=(9>a.a.L?0:b.nodes)?b.nodes():null;if(d)return a.a.S(d.cloneNode(!0).childNodes);b=b.text();return a.a.ba(b)};a.O.Oa=new a.O;a.ab(a.O.Oa);a.b("nativeTemplateEngine",a.O);(function(){a.Sa=function(){var a=this.kc=
function(){if(!w||!w.tmpl)return 0;try{if(0<=w.tmpl.tag.tmpl.open.toString().indexOf("__"))return 2}catch(a){}return 1}();this.renderTemplateSource=function(b,e,g){g=g||{};if(2>a)throw Error("Your version of jQuery.tmpl is too old. Please upgrade to jQuery.tmpl 1.0.0pre or later.");var h=b.data("precompiled");h||(h=b.text()||"",h=w.template(null,"{{ko_with $item.koBindingContext}}"+h+"{{/ko_with}}"),b.data("precompiled",h));b=[e.$data];e=w.extend({koBindingContext:e},g.templateOptions);e=w.tmpl(h,
b,e);e.appendTo(v.createElement("div"));w.fragments={};return e};this.createJavaScriptEvaluatorBlock=function(a){return"{{ko_code ((function() { return "+a+" })()) }}"};this.addTemplate=function(a,b){v.write("<script type='text/html' id='"+a+"'>"+b+"\x3c/script>")};0<a&&(w.tmpl.tag.ko_code={open:"__.push($1 || '');"},w.tmpl.tag.ko_with={open:"with($1) {",close:"} "})};a.Sa.prototype=new a.H;var b=new a.Sa;0<b.kc&&a.ab(b);a.b("jqueryTmplTemplateEngine",a.Sa)})()})})();})();
});

﻿/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/** @file Start the exam */

// 'base' gives the third-party libraries on which Numbas depends
Numbas.queueScript('base',['jquery','R','seedrandom','knockout','sarissa'],function() {
});

Numbas.queueScript('start-exam',['base','exam','settings'],function() {

	/**
	 * Initialise the exam:
	 *
	 * - Connect to the LMS, which might have saved student answers
	 * - Load the exam XML and the XSL templates
	 * - create and initialise the exam object
	 * - display the frontpage
	 *
	 * This function is called when all the other scripts have been loaded and executed. 
	 * It uses the scheduling system to make sure the browser isn't locked up when the exam is being initialised
	 * @memberof Numbas
	 * @method
	 */
	var init = Numbas.init = function()
	{
	$(document).ready(function() {
		var seed = Math.seedrandom();

		var job = Numbas.schedule.add;

		job(Numbas.xml.loadXMLDocs);				//load in all the XML and XSLT files

		job(Numbas.display.localisePage);

		job(function()
		{
			var store = Numbas.store = new Numbas.storage.SCORMStorage();	//The storage object manages communication between the LMS and the exam
			
			var exam = Numbas.exam = new Numbas.Exam();					//create the exam object, and load in everything from the XML
			exam.seed = Numbas.util.hashCode(seed);

			var entry = store.getEntry();
			if(store.getMode() == 'review')
				entry = 'review';

			switch(entry)
			{
			case 'ab-initio':
				job(exam.init,exam);
				job(Numbas.display.init);
				job(function() {
					if(exam.settings.showFrontPage)
					{
						exam.display.showInfoPage('frontpage');
					}
					else
					{
						exam.begin();
					}
				});	
				break;

			case 'resume':
			case 'review':
				job(exam.load,exam);
				job(Numbas.display.init);

				job(function() {
					if(entry == 'review')
					{
						job(exam.end,exam,false);
					}
					else if(exam.currentQuestion !== undefined)
					{
						job(exam.display.showInfoPage,exam.display,'suspend');
					}
					else
					{
						job(exam.display.showInfoPage,exam.display,'frontpage');
					}
				});

				break;
			}
		});

	});
	}

});

Numbas.queueScript('jquery-ui',['jquery'],function(module) {
/*! jQuery UI - v1.10.2 - 2013-03-25
* http://jqueryui.com
* Includes: jquery.ui.core.js, jquery.ui.position.js
* Copyright 2013 jQuery Foundation and other contributors Licensed MIT */

(function(e,t){function i(t,i){var a,n,r,o=t.nodeName.toLowerCase();return"area"===o?(a=t.parentNode,n=a.name,t.href&&n&&"map"===a.nodeName.toLowerCase()?(r=e("img[usemap=#"+n+"]")[0],!!r&&s(r)):!1):(/input|select|textarea|button|object/.test(o)?!t.disabled:"a"===o?t.href||i:i)&&s(t)}function s(t){return e.expr.filters.visible(t)&&!e(t).parents().addBack().filter(function(){return"hidden"===e.css(this,"visibility")}).length}var a=0,n=/^ui-id-\d+$/;e.ui=e.ui||{},e.extend(e.ui,{version:"1.10.2",keyCode:{BACKSPACE:8,COMMA:188,DELETE:46,DOWN:40,END:35,ENTER:13,ESCAPE:27,HOME:36,LEFT:37,NUMPAD_ADD:107,NUMPAD_DECIMAL:110,NUMPAD_DIVIDE:111,NUMPAD_ENTER:108,NUMPAD_MULTIPLY:106,NUMPAD_SUBTRACT:109,PAGE_DOWN:34,PAGE_UP:33,PERIOD:190,RIGHT:39,SPACE:32,TAB:9,UP:38}}),e.fn.extend({focus:function(t){return function(i,s){return"number"==typeof i?this.each(function(){var t=this;setTimeout(function(){e(t).focus(),s&&s.call(t)},i)}):t.apply(this,arguments)}}(e.fn.focus),scrollParent:function(){var t;return t=e.ui.ie&&/(static|relative)/.test(this.css("position"))||/absolute/.test(this.css("position"))?this.parents().filter(function(){return/(relative|absolute|fixed)/.test(e.css(this,"position"))&&/(auto|scroll)/.test(e.css(this,"overflow")+e.css(this,"overflow-y")+e.css(this,"overflow-x"))}).eq(0):this.parents().filter(function(){return/(auto|scroll)/.test(e.css(this,"overflow")+e.css(this,"overflow-y")+e.css(this,"overflow-x"))}).eq(0),/fixed/.test(this.css("position"))||!t.length?e(document):t},zIndex:function(i){if(i!==t)return this.css("zIndex",i);if(this.length)for(var s,a,n=e(this[0]);n.length&&n[0]!==document;){if(s=n.css("position"),("absolute"===s||"relative"===s||"fixed"===s)&&(a=parseInt(n.css("zIndex"),10),!isNaN(a)&&0!==a))return a;n=n.parent()}return 0},uniqueId:function(){return this.each(function(){this.id||(this.id="ui-id-"+ ++a)})},removeUniqueId:function(){return this.each(function(){n.test(this.id)&&e(this).removeAttr("id")})}}),e.extend(e.expr[":"],{data:e.expr.createPseudo?e.expr.createPseudo(function(t){return function(i){return!!e.data(i,t)}}):function(t,i,s){return!!e.data(t,s[3])},focusable:function(t){return i(t,!isNaN(e.attr(t,"tabindex")))},tabbable:function(t){var s=e.attr(t,"tabindex"),a=isNaN(s);return(a||s>=0)&&i(t,!a)}}),e("<a>").outerWidth(1).jquery||e.each(["Width","Height"],function(i,s){function a(t,i,s,a){return e.each(n,function(){i-=parseFloat(e.css(t,"padding"+this))||0,s&&(i-=parseFloat(e.css(t,"border"+this+"Width"))||0),a&&(i-=parseFloat(e.css(t,"margin"+this))||0)}),i}var n="Width"===s?["Left","Right"]:["Top","Bottom"],r=s.toLowerCase(),o={innerWidth:e.fn.innerWidth,innerHeight:e.fn.innerHeight,outerWidth:e.fn.outerWidth,outerHeight:e.fn.outerHeight};e.fn["inner"+s]=function(i){return i===t?o["inner"+s].call(this):this.each(function(){e(this).css(r,a(this,i)+"px")})},e.fn["outer"+s]=function(t,i){return"number"!=typeof t?o["outer"+s].call(this,t):this.each(function(){e(this).css(r,a(this,t,!0,i)+"px")})}}),e.fn.addBack||(e.fn.addBack=function(e){return this.add(null==e?this.prevObject:this.prevObject.filter(e))}),e("<a>").data("a-b","a").removeData("a-b").data("a-b")&&(e.fn.removeData=function(t){return function(i){return arguments.length?t.call(this,e.camelCase(i)):t.call(this)}}(e.fn.removeData)),e.ui.ie=!!/msie [\w.]+/.exec(navigator.userAgent.toLowerCase()),e.support.selectstart="onselectstart"in document.createElement("div"),e.fn.extend({disableSelection:function(){return this.bind((e.support.selectstart?"selectstart":"mousedown")+".ui-disableSelection",function(e){e.preventDefault()})},enableSelection:function(){return this.unbind(".ui-disableSelection")}}),e.extend(e.ui,{plugin:{add:function(t,i,s){var a,n=e.ui[t].prototype;for(a in s)n.plugins[a]=n.plugins[a]||[],n.plugins[a].push([i,s[a]])},call:function(e,t,i){var s,a=e.plugins[t];if(a&&e.element[0].parentNode&&11!==e.element[0].parentNode.nodeType)for(s=0;a.length>s;s++)e.options[a[s][0]]&&a[s][1].apply(e.element,i)}},hasScroll:function(t,i){if("hidden"===e(t).css("overflow"))return!1;var s=i&&"left"===i?"scrollLeft":"scrollTop",a=!1;return t[s]>0?!0:(t[s]=1,a=t[s]>0,t[s]=0,a)}})})(jQuery);(function(t,e){function i(t,e,i){return[parseFloat(t[0])*(p.test(t[0])?e/100:1),parseFloat(t[1])*(p.test(t[1])?i/100:1)]}function s(e,i){return parseInt(t.css(e,i),10)||0}function n(e){var i=e[0];return 9===i.nodeType?{width:e.width(),height:e.height(),offset:{top:0,left:0}}:t.isWindow(i)?{width:e.width(),height:e.height(),offset:{top:e.scrollTop(),left:e.scrollLeft()}}:i.preventDefault?{width:0,height:0,offset:{top:i.pageY,left:i.pageX}}:{width:e.outerWidth(),height:e.outerHeight(),offset:e.offset()}}t.ui=t.ui||{};var a,o=Math.max,r=Math.abs,h=Math.round,l=/left|center|right/,c=/top|center|bottom/,u=/[\+\-]\d+(\.[\d]+)?%?/,d=/^\w+/,p=/%$/,f=t.fn.position;t.position={scrollbarWidth:function(){if(a!==e)return a;var i,s,n=t("<div style='display:block;width:50px;height:50px;overflow:hidden;'><div style='height:100px;width:auto;'></div></div>"),o=n.children()[0];return t("body").append(n),i=o.offsetWidth,n.css("overflow","scroll"),s=o.offsetWidth,i===s&&(s=n[0].clientWidth),n.remove(),a=i-s},getScrollInfo:function(e){var i=e.isWindow?"":e.element.css("overflow-x"),s=e.isWindow?"":e.element.css("overflow-y"),n="scroll"===i||"auto"===i&&e.width<e.element[0].scrollWidth,a="scroll"===s||"auto"===s&&e.height<e.element[0].scrollHeight;return{width:a?t.position.scrollbarWidth():0,height:n?t.position.scrollbarWidth():0}},getWithinInfo:function(e){var i=t(e||window),s=t.isWindow(i[0]);return{element:i,isWindow:s,offset:i.offset()||{left:0,top:0},scrollLeft:i.scrollLeft(),scrollTop:i.scrollTop(),width:s?i.width():i.outerWidth(),height:s?i.height():i.outerHeight()}}},t.fn.position=function(e){if(!e||!e.of)return f.apply(this,arguments);e=t.extend({},e);var a,p,m,g,v,_,b=t(e.of),y=t.position.getWithinInfo(e.within),w=t.position.getScrollInfo(y),x=(e.collision||"flip").split(" "),k={};return _=n(b),b[0].preventDefault&&(e.at="left top"),p=_.width,m=_.height,g=_.offset,v=t.extend({},g),t.each(["my","at"],function(){var t,i,s=(e[this]||"").split(" ");1===s.length&&(s=l.test(s[0])?s.concat(["center"]):c.test(s[0])?["center"].concat(s):["center","center"]),s[0]=l.test(s[0])?s[0]:"center",s[1]=c.test(s[1])?s[1]:"center",t=u.exec(s[0]),i=u.exec(s[1]),k[this]=[t?t[0]:0,i?i[0]:0],e[this]=[d.exec(s[0])[0],d.exec(s[1])[0]]}),1===x.length&&(x[1]=x[0]),"right"===e.at[0]?v.left+=p:"center"===e.at[0]&&(v.left+=p/2),"bottom"===e.at[1]?v.top+=m:"center"===e.at[1]&&(v.top+=m/2),a=i(k.at,p,m),v.left+=a[0],v.top+=a[1],this.each(function(){var n,l,c=t(this),u=c.outerWidth(),d=c.outerHeight(),f=s(this,"marginLeft"),_=s(this,"marginTop"),D=u+f+s(this,"marginRight")+w.width,T=d+_+s(this,"marginBottom")+w.height,C=t.extend({},v),M=i(k.my,c.outerWidth(),c.outerHeight());"right"===e.my[0]?C.left-=u:"center"===e.my[0]&&(C.left-=u/2),"bottom"===e.my[1]?C.top-=d:"center"===e.my[1]&&(C.top-=d/2),C.left+=M[0],C.top+=M[1],t.support.offsetFractions||(C.left=h(C.left),C.top=h(C.top)),n={marginLeft:f,marginTop:_},t.each(["left","top"],function(i,s){t.ui.position[x[i]]&&t.ui.position[x[i]][s](C,{targetWidth:p,targetHeight:m,elemWidth:u,elemHeight:d,collisionPosition:n,collisionWidth:D,collisionHeight:T,offset:[a[0]+M[0],a[1]+M[1]],my:e.my,at:e.at,within:y,elem:c})}),e.using&&(l=function(t){var i=g.left-C.left,s=i+p-u,n=g.top-C.top,a=n+m-d,h={target:{element:b,left:g.left,top:g.top,width:p,height:m},element:{element:c,left:C.left,top:C.top,width:u,height:d},horizontal:0>s?"left":i>0?"right":"center",vertical:0>a?"top":n>0?"bottom":"middle"};u>p&&p>r(i+s)&&(h.horizontal="center"),d>m&&m>r(n+a)&&(h.vertical="middle"),h.important=o(r(i),r(s))>o(r(n),r(a))?"horizontal":"vertical",e.using.call(this,t,h)}),c.offset(t.extend(C,{using:l}))})},t.ui.position={fit:{left:function(t,e){var i,s=e.within,n=s.isWindow?s.scrollLeft:s.offset.left,a=s.width,r=t.left-e.collisionPosition.marginLeft,h=n-r,l=r+e.collisionWidth-a-n;e.collisionWidth>a?h>0&&0>=l?(i=t.left+h+e.collisionWidth-a-n,t.left+=h-i):t.left=l>0&&0>=h?n:h>l?n+a-e.collisionWidth:n:h>0?t.left+=h:l>0?t.left-=l:t.left=o(t.left-r,t.left)},top:function(t,e){var i,s=e.within,n=s.isWindow?s.scrollTop:s.offset.top,a=e.within.height,r=t.top-e.collisionPosition.marginTop,h=n-r,l=r+e.collisionHeight-a-n;e.collisionHeight>a?h>0&&0>=l?(i=t.top+h+e.collisionHeight-a-n,t.top+=h-i):t.top=l>0&&0>=h?n:h>l?n+a-e.collisionHeight:n:h>0?t.top+=h:l>0?t.top-=l:t.top=o(t.top-r,t.top)}},flip:{left:function(t,e){var i,s,n=e.within,a=n.offset.left+n.scrollLeft,o=n.width,h=n.isWindow?n.scrollLeft:n.offset.left,l=t.left-e.collisionPosition.marginLeft,c=l-h,u=l+e.collisionWidth-o-h,d="left"===e.my[0]?-e.elemWidth:"right"===e.my[0]?e.elemWidth:0,p="left"===e.at[0]?e.targetWidth:"right"===e.at[0]?-e.targetWidth:0,f=-2*e.offset[0];0>c?(i=t.left+d+p+f+e.collisionWidth-o-a,(0>i||r(c)>i)&&(t.left+=d+p+f)):u>0&&(s=t.left-e.collisionPosition.marginLeft+d+p+f-h,(s>0||u>r(s))&&(t.left+=d+p+f))},top:function(t,e){var i,s,n=e.within,a=n.offset.top+n.scrollTop,o=n.height,h=n.isWindow?n.scrollTop:n.offset.top,l=t.top-e.collisionPosition.marginTop,c=l-h,u=l+e.collisionHeight-o-h,d="top"===e.my[1],p=d?-e.elemHeight:"bottom"===e.my[1]?e.elemHeight:0,f="top"===e.at[1]?e.targetHeight:"bottom"===e.at[1]?-e.targetHeight:0,m=-2*e.offset[1];0>c?(s=t.top+p+f+m+e.collisionHeight-o-a,t.top+p+f+m>c&&(0>s||r(c)>s)&&(t.top+=p+f+m)):u>0&&(i=t.top-e.collisionPosition.marginTop+p+f+m-h,t.top+p+f+m>u&&(i>0||u>r(i))&&(t.top+=p+f+m))}},flipfit:{left:function(){t.ui.position.flip.left.apply(this,arguments),t.ui.position.fit.left.apply(this,arguments)},top:function(){t.ui.position.flip.top.apply(this,arguments),t.ui.position.fit.top.apply(this,arguments)}}},function(){var e,i,s,n,a,o=document.getElementsByTagName("body")[0],r=document.createElement("div");e=document.createElement(o?"div":"body"),s={visibility:"hidden",width:0,height:0,border:0,margin:0,background:"none"},o&&t.extend(s,{position:"absolute",left:"-1000px",top:"-1000px"});for(a in s)e.style[a]=s[a];e.appendChild(r),i=o||document.documentElement,i.insertBefore(e,i.firstChild),r.style.cssText="position: absolute; left: 10.7432222px;",n=t(r).offset().left,t.support.offsetFractions=n>10&&11>n,e.innerHTML="",i.removeChild(e)}()})(jQuery);
});

/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/


Numbas.queueScript('storage',['base'],function() {

/** @namespace Numbas.storage */

/** @typedef exam_suspend_data
 * @memberof Numbas.storage
 * @property {number} timeRemaining - seconds until exam timer runs out
 * @property {number[]} questionSubset - order of questions
 * @property {number} start - time the exam started
 * @property {number} score - student's current score
 * @property {number} currentQuestion - number of the question the student was looking at before suspending
 */

/** @typedef question_suspend_data
 * @memberof Numbas.storage
 * @property {number} score - student's current score on this question ({@link Numbas.Question#score})
 * @property {boolean} visited - has the student looked at this question? ({@link Numbas.Question#visited})
 * @property {boolean} answered - has the student answered this question? ({@link Numbas.Question#answered})
 * @property {boolean} submitted - how many times has the student submitted this question? ({@link Numbas.Question#submitted})
 * @property {boolean} adviceDisplayed - has the advice been shown to the student? ({@link Numbas.Question#adviceDisplayed})
 * @property {boolean} revealed - have the correct answers been revealed to the student? ({@link Numbas.Question#revealed})
 * @property {object} variables - dictionary mapping variable names to values, in {@link JME} format.
 */

/** @typedef part_suspend_data
 * @memberof Numbas.storage
 * @property {string} answer - student's answer to the part, as encoded for saving
 * @property {boolean} answered - has the student answered this part? ({@link Numbas.parts.Part#answered})
 * @property {boolean} stepsShown - have the steps been shown? ({@link Numbas.parts.Part#stepsShown})
 * @property {boolean} stepsOpen - are the steps currently visible? ({@link Numbas.parts.Part#stepsOpen})
 * @property {part_suspend_data[]} gaps - data for gaps, if this is a gapfill part
 * @property {part_suspend_data[]} steps - data for steps, if this part has steps
 * @property {string} studentAnswer - student's answer, for {@link Numbas.parts.JMEPart}, {@link Numbas.parts.NumberEntryPart} or {@link Numbas.parts.PatternMatchPart} parts
 * @property {number[]} shuffleChoices - order of choices, if this is a {@link Numbas.parts.MultipleResponsePart}
 * @property {number[]} shuffleAnswers - order of answers, if this is a {@link Numbas.parts.MultipleResponsePart}
 * @property {Array.Array.<number>} ticks - student's choices, for {@link Numbas.parts.MultipleResponsePart} parts
 */


/** The active storage object ({@link Numbas.storage}) to be used by the exam */
Numbas.store = null;

Numbas.storage = {};

/** A blank storage object which does nothing.
 *
 * Any real storage object needs to implement all of this object's methods.
 * @memberof Numbas.storage
 * @constructor
 */
Numbas.storage.BlankStorage = function() {}
Numbas.storage.BlankStorage.prototype = /** @lends Numbas.storage.BlankStorage.prototype */ {

	/** Initialise the SCORM data model and this storage object.
	 * @param {Numbas.Exam} exam
	 */
	init: function(exam) {},

	/** Get suspended exam info
	 * @param {Numbas.Exam} exam
	 * @returns {exam_suspend_data}
	 */
	load: function() {},

	/** Save SCORM data - call the SCORM commit method to make sure the data model is saved to the server/backing store */
	save: function() {
	},

	/** Get suspended info for a question
	 * @param {Numbas.Question} question
	 * @returns {question_suspend_data}
	 */
	loadQuestion: function(questionNumber) {},

	/** Get suspended info for a part
	 * @param {Numbas.parts.Part} part
	 * @returns {part_suspend_data}
	 */
	loadPart: function(part) {},

	/** Load a {@link Numbas.parts.JMEPart}
	 * @param {Numbas.parts.Part} part
	 * @returns {part_suspend_data}
	 */
	loadJMEPart: function(part) {},

	/** Load a {@link Numbas.parts.PatternMatchPart}
	 * @param {Numbas.parts.Part} part
	 * @returns {part_suspend_data}
	 */
	loadPatternMatchPart: function(part) {},

	/** Load a {@link Numbas.parts.NumberEntryPart}
	 * @param {Numbas.parts.Part} part
	 * @returns {part_suspend_data}
	 */
	loadNumberEntryPart: function(part) {},

	/** Load a {@link Numbas.parts.MatrixEntryPart}
	 * @param {Numbas.parts.Part} part
	 * @returns {part_suspend_data}
	 */
	loadMatrixEntryPart: function(part) {},

	/** Load a {@link Numbas.parts.MultipleResponsePart}
	 * @param {Numbas.parts.Part} part
	 * @returns {part_suspend_data}
	 */
	loadMultipleResponsePart: function(part) {},

	/** Call this when the exam is started (when {@link Numbas.Exam#begin} runs, not when the page loads) */
	start: function() {},

	/** Call this when the exam is paused ({@link Numbas.Exam#pause}) */
	pause: function() {},

	/** Call this when the exam is resumed ({@link Numbas.Exam#resume}) */
	resume: function() {},

	/** Call this when the exam ends ({@link Numbas.Exam#end}) */
	end: function() {},

	/** Get the student's ID
	 * @returns {string}
	 */
	getStudentID: function() {
		return '';
	},

	/** Get entry state: `ab-initio`, or `resume`
	 * @returns {string}
	 */
	getEntry: function() { 
		return 'ab-initio';
	},

	/** Get viewing mode: 
	 *
	 * * `browse` - see exam info, not questions
	 * * `normal` - sit exam
	 * * `review` - look at completed exam
	 * @returns {string}
	 */
	getMode: function() {},

	/** Call this when the student moves to a different question
	 * @param {Numbas.Question} question
	 */
	changeQuestion: function(question) {},

	/** Call this when a part is answered
	 * @param {Numbas.parts.Part} part
	 */
	partAnswered: function(part) {},

	/** Save exam-level details (just score at the mo)
	 * @param {Numbas.Exam} exam
	 */
	saveExam: function(exam) {},

	/* Save details about a question - save score and success status
	 * @param {Numbas.Question} question
	 */
	saveQuestion: function(question) {},

	/** Record that a question has been submitted
	 * @param {Numbas.Question} question
	 */
	questionSubmitted: function(question) {},

	/** Rcord that the student displayed question advice
	 * @param {Numbas.Question} question
	 */
	adviceDisplayed: function(question) {},

	/** Record that the student revealed the answers to a question
	 * @param {Numbas.Question} question
	 */
	answerRevealed: function(question) {},

	/** Record that the student showed the steps for a part
	 * @param {Numbas.parts.Part} part
	 */
	stepsShown: function(part) {},

	/** Record that the student hid the steps for a part
	 * @param {Numbas.parts.Part} part
	 */
	stepsHidden: function(part) {}
};
});

Numbas.queueScript('sarissa',[],function(module) {
/*
 * ====================================================================
 * About Sarissa: http://dev.abiss.gr/sarissa
 * ====================================================================
 * Sarissa is an ECMAScript library acting as a cross-browser wrapper for native XML APIs.
 * The library supports Gecko based browsers like Mozilla and Firefox,
 * Internet Explorer (5.5+ with MSXML3.0+), Konqueror, Safari and Opera
 * @version 0.9.9.5
 * @author: Copyright 2004-2008 Emmanouil Batsis, mailto: mbatsis at users full stop sourceforge full stop net
 * ====================================================================
 * Licence
 * ====================================================================
 * Sarissa is free software distributed under the GNU GPL version 2 (see <a href="gpl.txt">gpl.txt</a>) or higher, 
 * GNU LGPL version 2.1 (see <a href="lgpl.txt">lgpl.txt</a>) or higher and Apache Software License 2.0 or higher 
 * (see <a href="asl.txt">asl.txt</a>). This means you can choose one of the three and use that if you like. If 
 * you make modifications under the ASL, i would appreciate it if you submitted those.
 * In case your copy of Sarissa does not include the license texts, you may find
 * them online in various formats at <a href="http://www.gnu.org">http://www.gnu.org</a> and 
 * <a href="http://www.apache.org">http://www.apache.org</a>.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY 
 * KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE 
 * WARRANTIES OF MERCHANTABILITY,FITNESS FOR A PARTICULAR PURPOSE 
 * AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR 
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR 
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
/**
 * <p>Sarissa is a utility class. Provides "static" methods for DOMDocument, 
 * DOM Node serialization to XML strings and other utility goodies.</p>
 * @constructor
 * @static
 */
function Sarissa(){}
Sarissa.VERSION = "0.9.9.5";
Sarissa.PARSED_OK = "Document contains no parsing errors";
Sarissa.PARSED_EMPTY = "Document is empty";
Sarissa.PARSED_UNKNOWN_ERROR = "Not well-formed or other error";
Sarissa.IS_ENABLED_TRANSFORM_NODE = false;
Sarissa.REMOTE_CALL_FLAG = "gr.abiss.sarissa.REMOTE_CALL_FLAG";
/** @private */
Sarissa._lastUniqueSuffix = 0;
/** @private */
Sarissa._getUniqueSuffix = function(){
	return Sarissa._lastUniqueSuffix++;
};
/** @private */
Sarissa._SARISSA_IEPREFIX4XSLPARAM = "";
/** @private */
Sarissa._SARISSA_HAS_DOM_IMPLEMENTATION = document.implementation && true;
/** @private */
Sarissa._SARISSA_HAS_DOM_CREATE_DOCUMENT = Sarissa._SARISSA_HAS_DOM_IMPLEMENTATION && document.implementation.createDocument;
/** @private */
Sarissa._SARISSA_HAS_DOM_FEATURE = Sarissa._SARISSA_HAS_DOM_IMPLEMENTATION && document.implementation.hasFeature;
/** @private */
Sarissa._SARISSA_IS_MOZ = Sarissa._SARISSA_HAS_DOM_CREATE_DOCUMENT && Sarissa._SARISSA_HAS_DOM_FEATURE;
/** @private */
Sarissa._SARISSA_IS_SAFARI = navigator.userAgent.toLowerCase().indexOf("safari") != -1 || navigator.userAgent.toLowerCase().indexOf("konqueror") != -1;
/** @private */
Sarissa._SARISSA_IS_SAFARI_OLD = Sarissa._SARISSA_IS_SAFARI && (parseInt((navigator.userAgent.match(/AppleWebKit\/(\d+)/)||{})[1], 10) < 420);
/** @private */
Sarissa._SARISSA_IS_IE = (document.all && window.ActiveXObject && navigator.userAgent.toLowerCase().indexOf("msie") > -1  && navigator.userAgent.toLowerCase().indexOf("opera") == -1) || (!window.ActiveXObject && "ActiveXObject" in window);
/** @private */
Sarissa._SARISSA_IS_OPERA = navigator.userAgent.toLowerCase().indexOf("opera") != -1;
if(!window.Node || !Node.ELEMENT_NODE){
    Node = {ELEMENT_NODE: 1, ATTRIBUTE_NODE: 2, TEXT_NODE: 3, CDATA_SECTION_NODE: 4, ENTITY_REFERENCE_NODE: 5,  ENTITY_NODE: 6, PROCESSING_INSTRUCTION_NODE: 7, COMMENT_NODE: 8, DOCUMENT_NODE: 9, DOCUMENT_TYPE_NODE: 10, DOCUMENT_FRAGMENT_NODE: 11, NOTATION_NODE: 12};
}

//This breaks for(x in o) loops in the old Safari
if(Sarissa._SARISSA_IS_SAFARI_OLD){
	HTMLHtmlElement = document.createElement("html").constructor;
	Node = HTMLElement = {};
	HTMLElement.prototype = HTMLHtmlElement.__proto__.__proto__;
	HTMLDocument = Document = document.constructor;
	var x = new DOMParser();
	XMLDocument = x.constructor;
	Element = x.parseFromString("<Single />", "text/xml").documentElement.constructor;
	x = null;
}
if(typeof XMLDocument == "undefined" && typeof Document !="undefined"){ XMLDocument = Document; } 

// IE initialization
if(Sarissa._SARISSA_IS_IE){
    // for XSLT parameter names, prefix needed by IE
    Sarissa._SARISSA_IEPREFIX4XSLPARAM = "xsl:";
    // used to store the most recent ProgID available out of the above
    var _SARISSA_DOM_PROGID = "";
    var _SARISSA_XMLHTTP_PROGID = "";
    var _SARISSA_DOM_XMLWRITER = "";
    /**
     * Called when the sarissa.js file is parsed, to pick most recent
     * ProgIDs for IE, then gets destroyed.
     * @memberOf Sarissa
     * @private
     * @param idList an array of MSXML PROGIDs from which the most recent will be picked for a given object
     * @param enabledList an array of arrays where each array has two items; the index of the PROGID for which a certain feature is enabled
     */
    Sarissa.pickRecentProgID = function (idList){
        // found progID flag
        var bFound = false, e;
        var o2Store;
        for(var i=0; i < idList.length && !bFound; i++){
            try{
                var oDoc = new ActiveXObject(idList[i]);
                o2Store = idList[i];
                bFound = true;
            }catch (objException){
                // trap; try next progID
                e = objException;
            }
        }
        if (!bFound) {
            throw "Could not retrieve a valid progID of Class: " + idList[idList.length-1]+". (original exception: "+e+")";
        }
        idList = null;
        return o2Store;
    };
    // pick best available MSXML progIDs
    _SARISSA_DOM_PROGID = null;
    _SARISSA_THREADEDDOM_PROGID = null;
    _SARISSA_XSLTEMPLATE_PROGID = null;
    _SARISSA_XMLHTTP_PROGID = null;
    // commenting the condition out; we need to redefine XMLHttpRequest 
    // anyway as IE7 hardcodes it to MSXML3.0 causing version problems 
    // between different activex controls 
    //if(!window.XMLHttpRequest){
    /**
     * Emulate XMLHttpRequest
     * @constructor
     */
    XMLHttpRequest = function() {
        if(!_SARISSA_XMLHTTP_PROGID){
            _SARISSA_XMLHTTP_PROGID = Sarissa.pickRecentProgID(["Msxml2.XMLHTTP.6.0", "MSXML2.XMLHTTP.3.0", "MSXML2.XMLHTTP", "Microsoft.XMLHTTP"]);
        }
        return new ActiveXObject(_SARISSA_XMLHTTP_PROGID);
    };
    //}
    // we dont need this anymore
    //============================================
    // Factory methods (IE)
    //============================================
    // see non-IE version
    Sarissa.getDomDocument = function(sUri, sName){
        if(!_SARISSA_DOM_PROGID){
        	try{
        		_SARISSA_DOM_PROGID = Sarissa.pickRecentProgID(["Msxml2.DOMDocument.6.0", "Msxml2.DOMDocument.3.0", "MSXML2.DOMDocument", "MSXML.DOMDocument", "Microsoft.XMLDOM"]);
        	}catch(e){
        		_SARISSA_DOM_PROGID = "noActiveX";
        	}
        }

        // Not sure how far IE can carry this but try to do something useful when ActiveX is disabled
        var oDoc = _SARISSA_DOM_PROGID == "noActiveX" ? document.createElement("xml") : new ActiveXObject(_SARISSA_DOM_PROGID);
        // set validation off, make sure older IEs dont choke (no time or IEs to test ;-)
        try{
        	oDoc.validateOnParse = false; 
        	oDoc.resolveExternals = "false";
        	oDoc.setProperty("ProhibitDTD", false);
        }catch(e){}
        
        // if a root tag name was provided, we need to load it in the DOM object
        if (sName){
            // create an artifical namespace prefix 
            // or reuse existing prefix if applicable
            var prefix = "";
            if(sUri){
                if(sName.indexOf(":") > 1){
                    prefix = sName.substring(0, sName.indexOf(":"));
                    sName = sName.substring(sName.indexOf(":")+1); 
                }else{
                    prefix = "a" + Sarissa._getUniqueSuffix();
                }
            }
            // use namespaces if a namespace URI exists
            if(sUri){
                oDoc.loadXML('<' + prefix+':'+sName + " xmlns:" + prefix + "=\"" + sUri + "\"" + " />");
            } else {
                oDoc.loadXML('<' + sName + " />");
            }
        }
        return oDoc;
    };
    // see non-IE version   
    Sarissa.getParseErrorText = function (oDoc) {
        var parseErrorText = Sarissa.PARSED_OK;
        if(oDoc && oDoc.parseError && oDoc.parseError.errorCode && oDoc.parseError.errorCode != 0){
            parseErrorText = "XML Parsing Error: " + oDoc.parseError.reason + 
                "\nLocation: " + oDoc.parseError.url + 
                "\nLine Number " + oDoc.parseError.line + ", Column " + 
                oDoc.parseError.linepos + 
                ":\n" + oDoc.parseError.srcText +
                "\n";
            for(var i = 0;  i < oDoc.parseError.linepos;i++){
                parseErrorText += "-";
            }
            parseErrorText +=  "^\n";
        }
        else if(oDoc.documentElement === null){
            parseErrorText = Sarissa.PARSED_EMPTY;
        }
        return parseErrorText;
    };
    // see non-IE version
    Sarissa.setXpathNamespaces = function(oDoc, sNsSet) {
        oDoc.setProperty("SelectionLanguage", "XPath");
        oDoc.setProperty("SelectionNamespaces", sNsSet);
    };
    /**
     * A class that reuses the same XSLT stylesheet for multiple transforms.
     * @constructor
     */
    XSLTProcessor = function(){
        if(!_SARISSA_XSLTEMPLATE_PROGID){
            _SARISSA_XSLTEMPLATE_PROGID = Sarissa.pickRecentProgID(["Msxml2.XSLTemplate.6.0", "MSXML2.XSLTemplate.3.0"]);
        }
        this.template = new ActiveXObject(_SARISSA_XSLTEMPLATE_PROGID);
        this.processor = null;
    };
    /**
     * Imports the given XSLT DOM and compiles it to a reusable transform
     * <b>Note:</b> If the stylesheet was loaded from a URL and contains xsl:import or xsl:include elements,it will be reloaded to resolve those
     * @param {DOMDocument} xslDoc The XSLT DOMDocument to import
     */
    XSLTProcessor.prototype.importStylesheet = function(xslDoc){
        if(!_SARISSA_THREADEDDOM_PROGID){
            _SARISSA_THREADEDDOM_PROGID = Sarissa.pickRecentProgID(["MSXML2.FreeThreadedDOMDocument.6.0", "MSXML2.FreeThreadedDOMDocument.3.0"]);
        }
        xslDoc.setProperty("SelectionLanguage", "XPath");
        xslDoc.setProperty("SelectionNamespaces", "xmlns:xsl='http://www.w3.org/1999/XSL/Transform'");
        // convert stylesheet to free threaded
        var converted = new ActiveXObject(_SARISSA_THREADEDDOM_PROGID);
        // make included/imported stylesheets work if exist and xsl was originally loaded from url
        try{
            converted.resolveExternals = true; 
            converted.setProperty("AllowDocumentFunction", true); 
            converted.setProperty("AllowXsltScript", true);
        }
        catch(e){
            // Ignore. "AllowDocumentFunction" and "AllowXsltScript" is only supported in MSXML 3.0 SP4+ and 3.0 SP8+ respectively.
        } 
        if(xslDoc.url && xslDoc.selectSingleNode("//xsl:*[local-name() = 'import' or local-name() = 'include']") != null){
            converted.async = false;
            converted.load(xslDoc.url);
        } 
        else {
            converted.loadXML(xslDoc.xml);
        }
        converted.setProperty("SelectionNamespaces", "xmlns:xsl='http://www.w3.org/1999/XSL/Transform'");
        var output = converted.selectSingleNode("//xsl:output");
        //this.outputMethod = output ? output.getAttribute("method") : "html";
        if(output) {
            this.outputMethod = output.getAttribute("method");
        } 
        else {
            delete this.outputMethod;
        } 
        this.template.stylesheet = converted;
        this.processor = this.template.createProcessor();
        // for getParameter and clearParameters
        this.paramsSet = [];
    };

    /**
     * Transform the given XML DOM and return the transformation result as a new DOM document
     * @param {DOMDocument} sourceDoc The XML DOMDocument to transform
     * @return {DOMDocument} The transformation result as a DOM Document
     */
    XSLTProcessor.prototype.transformToDocument = function(sourceDoc){
        // fix for bug 1549749
        var outDoc;
        if(_SARISSA_THREADEDDOM_PROGID){
            this.processor.input=sourceDoc;
            outDoc=new ActiveXObject(_SARISSA_DOM_PROGID);
            this.processor.output=outDoc;
            this.processor.transform();
            return outDoc;
        }
        else{
            if(!_SARISSA_DOM_XMLWRITER){
                _SARISSA_DOM_XMLWRITER = Sarissa.pickRecentProgID(["Msxml2.MXXMLWriter.6.0", "Msxml2.MXXMLWriter.3.0", "MSXML2.MXXMLWriter", "MSXML.MXXMLWriter", "Microsoft.XMLDOM"]);
            }
            this.processor.input = sourceDoc;
            outDoc = new ActiveXObject(_SARISSA_DOM_XMLWRITER);
            this.processor.output = outDoc; 
            this.processor.transform();
            var oDoc = new ActiveXObject(_SARISSA_DOM_PROGID);
            oDoc.loadXML(outDoc.output+"");
            return oDoc;
        }
    };
    
    /**
     * Transform the given XML DOM and return the transformation result as a new DOM fragment.
     * <b>Note</b>: The xsl:output method must match the nature of the owner document (XML/HTML).
     * @param {DOMDocument} sourceDoc The XML DOMDocument to transform
     * @param {DOMDocument} ownerDoc The owner of the result fragment
     * @return {DOMDocument} The transformation result as a DOM Document
     */
    XSLTProcessor.prototype.transformToFragment = function (sourceDoc, ownerDoc) {
        this.processor.input = sourceDoc;
        this.processor.transform();
        var s = this.processor.output;
        var f = ownerDoc.createDocumentFragment();
        var container;
        if (this.outputMethod == 'text') {
            f.appendChild(ownerDoc.createTextNode(s));
        } else if (ownerDoc.body && ownerDoc.body.innerHTML) {
            container = ownerDoc.createElement('div');
            container.innerHTML = s;
            while (container.hasChildNodes()) {
                f.appendChild(container.firstChild);
            }
        }
        else {
            var oDoc = new ActiveXObject(_SARISSA_DOM_PROGID);
            if (s.substring(0, 5) == '<?xml') {
                s = s.substring(s.indexOf('?>') + 2);
            }
            var xml = ''.concat('<my>', s, '</my>');
            oDoc.loadXML(xml);
            container = oDoc.documentElement;
            while (container.hasChildNodes()) {
                f.appendChild(container.firstChild);
            }
        }
        return f;
    };
    
    /**
     * Set global XSLT parameter of the imported stylesheet. This method should 
     * only be used <strong>after</strong> the importStylesheet method for the 
     * context XSLTProcessor instance.
     * @param {String} nsURI The parameter namespace URI
     * @param {String} name The parameter base name
     * @param {String} value The new parameter value
     */
     XSLTProcessor.prototype.setParameter = function(nsURI, name, value){
         // make value a zero length string if null to allow clearing
         value = value ? value : "";
         // nsURI is optional but cannot be null
         if(nsURI){
             this.processor.addParameter(name, value, nsURI);
         }else{
             this.processor.addParameter(name, value);
         }
         // update updated params for getParameter
         nsURI = "" + (nsURI || "");
         if(!this.paramsSet[nsURI]){
             this.paramsSet[nsURI] = [];
         }
         this.paramsSet[nsURI][name] = value;
     };
    /**
     * Gets a parameter if previously set by setParameter. Returns null
     * otherwise
     * @param {String} name The parameter base name
     * @param {String} value The new parameter value
     * @return {String} The parameter value if reviously set by setParameter, null otherwise
     */
    XSLTProcessor.prototype.getParameter = function(nsURI, name){
        nsURI = "" + (nsURI || "");
        if(this.paramsSet[nsURI] && this.paramsSet[nsURI][name]){
            return this.paramsSet[nsURI][name];
        }else{
            return null;
        }
    };
    
    /**
     * Clear parameters (set them to default values as defined in the stylesheet itself)
     */
    XSLTProcessor.prototype.clearParameters = function(){
        for(var nsURI in this.paramsSet){
            for(var name in this.paramsSet[nsURI]){
                if(nsURI!=""){
                    this.processor.addParameter(name, "", nsURI);
                }else{
                    this.processor.addParameter(name, "");
                }
            }
        }
        this.paramsSet = [];
    };
}else{ /* end IE initialization, try to deal with real browsers now ;-) */
    if(Sarissa._SARISSA_HAS_DOM_CREATE_DOCUMENT){
        /**
         * <p>Ensures the document was loaded correctly, otherwise sets the
         * parseError to -1 to indicate something went wrong. Internal use</p>
         * @private
         */
        Sarissa.__handleLoad__ = function(oDoc){
            Sarissa.__setReadyState__(oDoc, 4);
        };
        /**
        * <p>Attached by an event handler to the load event. Internal use.</p>
        * @private
        */
        _sarissa_XMLDocument_onload = function(){
            Sarissa.__handleLoad__(this);
        };
        /**
         * <p>Sets the readyState property of the given DOM Document object.
         * Internal use.</p>
         * @memberOf Sarissa
         * @private
         * @param oDoc the DOM Document object to fire the
         *          readystatechange event
         * @param iReadyState the number to change the readystate property to
         */
        Sarissa.__setReadyState__ = function(oDoc, iReadyState){
            oDoc.readyState = iReadyState;
            oDoc.readystate = iReadyState;
            if (oDoc.onreadystatechange != null && typeof oDoc.onreadystatechange == "function") {
                oDoc.onreadystatechange();
            }
        };
        
        Sarissa.getDomDocument = function(sUri, sName){
            var oDoc = document.implementation.createDocument(sUri?sUri:null, sName?sName:null, null);
            if(!oDoc.onreadystatechange){
            
                /**
                * <p>Emulate IE's onreadystatechange attribute</p>
                */
                oDoc.onreadystatechange = null;
            }
            if(!oDoc.readyState){
                /**
                * <p>Emulates IE's readyState property, which always gives an integer from 0 to 4:</p>
                * <ul><li>1 == LOADING,</li>
                * <li>2 == LOADED,</li>
                * <li>3 == INTERACTIVE,</li>
                * <li>4 == COMPLETED</li></ul>
                */
                oDoc.readyState = 0;
            }
            oDoc.addEventListener("load", _sarissa_XMLDocument_onload, false);
            return oDoc;
        };
        if(window.XMLDocument){
            // do nothing
        }// TODO: check if the new document has content before trying to copynodes, check  for error handling in DOM 3 LS
        else if(Sarissa._SARISSA_HAS_DOM_FEATURE && window.Document && !Document.prototype.load && document.implementation.hasFeature('LS', '3.0')){
    		//Opera 9 may get the XPath branch which gives creates XMLDocument, therefore it doesn't reach here which is good
            /**
            * <p>Factory method to obtain a new DOM Document object</p>
            * @memberOf Sarissa
            * @param {String} sUri the namespace of the root node (if any)
            * @param {String} sUri the local name of the root node (if any)
            * @returns {DOMDOcument} a new DOM Document
            */
            Sarissa.getDomDocument = function(sUri, sName){
                var oDoc = document.implementation.createDocument(sUri?sUri:null, sName?sName:null, null);
                return oDoc;
            };
        }
        else {
            Sarissa.getDomDocument = function(sUri, sName){
                var oDoc = document.implementation.createDocument(sUri?sUri:null, sName?sName:null, null);
                // looks like safari does not create the root element for some unknown reason
                if(oDoc && (sUri || sName) && !oDoc.documentElement){
                    oDoc.appendChild(oDoc.createElementNS(sUri, sName));
                }
                return oDoc;
            };
        }
    }//if(Sarissa._SARISSA_HAS_DOM_CREATE_DOCUMENT)
}
//==========================================
// Common stuff
//==========================================
if(Sarissa._SARISSA_IS_IE || !window.DOMParser){
    if(Sarissa._SARISSA_IS_SAFARI){
        /**
         * DOMParser is a utility class, used to construct DOMDocuments from XML strings
         * @constructor
         */
        DOMParser = function() { };
        /** 
        * Construct a new DOM Document from the given XMLstring
        * @param {String} sXml the given XML string
        * @param {String} contentType the content type of the document the given string represents (one of text/xml, application/xml, application/xhtml+xml). 
        * @return {DOMDocument} a new DOM Document from the given XML string
        */
        DOMParser.prototype.parseFromString = function(sXml, contentType){
            var xmlhttp = new XMLHttpRequest();
            xmlhttp.open("GET", "data:text/xml;charset=utf-8," + encodeURIComponent(sXml), false);
            xmlhttp.send(null);
            return xmlhttp.responseXML;
        };
    }else if(Sarissa.getDomDocument && Sarissa.getDomDocument() && Sarissa.getDomDocument(null, "bar").xml){
        DOMParser = function() { };
        DOMParser.prototype.parseFromString = function(sXml, contentType){
            var doc = Sarissa.getDomDocument();
            try{
            	doc.validateOnParse = false; 
            	doc.setProperty("ProhibitDTD", false);
            }catch(e){}
            doc.loadXML(sXml);
            return doc;
        };
    }
}

if((typeof(document.importNode) == "undefined") && Sarissa._SARISSA_IS_IE){
    try{
        /**
        * Implementation of importNode for the context window document in IE.
        * If <code>oNode</code> is a TextNode, <code>bChildren</code> is ignored.
        * @param {DOMNode} oNode the Node to import
        * @param {boolean} bChildren whether to include the children of oNode
        * @returns the imported node for further use
        */
        document.importNode = function(oNode, bChildren){
            var tmp;
            if (oNode.nodeName=='#text') {
                return document.createTextNode(oNode.data);
            }
            else {
                if(oNode.nodeName == "tbody" || oNode.nodeName == "tr"){
                    tmp = document.createElement("table");
                }
                else if(oNode.nodeName == "td"){
                    tmp = document.createElement("tr");
                }
                else if(oNode.nodeName == "option"){
                    tmp = document.createElement("select");
                }
                else{
                    tmp = document.createElement("div");
                }
                if(bChildren){
                    tmp.innerHTML = oNode.xml ? oNode.xml : oNode.outerHTML;
                }else{
                    tmp.innerHTML = oNode.xml ? oNode.cloneNode(false).xml : oNode.cloneNode(false).outerHTML;
                }
                return tmp.getElementsByTagName("*")[0];
            }
        };
    }catch(e){ }
}
if(!Sarissa.getParseErrorText){
    /**
     * <p>Returns a human readable description of the parsing error. Usefull
     * for debugging. Tip: append the returned error string in a &lt;pre&gt;
     * element if you want to render it.</p>
     * <p>Many thanks to Christian Stocker for the initial patch.</p>
     * @memberOf Sarissa
     * @param {DOMDocument} oDoc The target DOM document
     * @returns {String} The parsing error description of the target Document in
     *          human readable form (preformated text)
     */
    Sarissa.getParseErrorText = function (oDoc){
        var parseErrorText = Sarissa.PARSED_OK;
        if((!oDoc) || (!oDoc.documentElement)){
            parseErrorText = Sarissa.PARSED_EMPTY;
        } else if(oDoc.documentElement.tagName == "parsererror"){
            parseErrorText = oDoc.documentElement.firstChild.data;
            parseErrorText += "\n" +  oDoc.documentElement.firstChild.nextSibling.firstChild.data;
        } else if(oDoc.getElementsByTagName("parsererror").length > 0){
            var parsererror = oDoc.getElementsByTagName("parsererror")[0];
            parseErrorText = Sarissa.getText(parsererror, true)+"\n";
        } else if(oDoc.parseError && oDoc.parseError.errorCode != 0){
            parseErrorText = Sarissa.PARSED_UNKNOWN_ERROR;
        }
        return parseErrorText;
    };
}
/**
 * Get a string with the concatenated values of all string nodes under the given node
 * @param {DOMNode} oNode the given DOM node
 * @param {boolean} deep whether to recursively scan the children nodes of the given node for text as well. Default is <code>false</code>
 * @memberOf Sarissa 
 */
Sarissa.getText = function(oNode, deep){
    var s = "";
    var nodes = oNode.childNodes;
    // opera fix, finds no child text node for attributes so we use .value
    if (oNode.nodeType == Node.ATTRIBUTE_NODE && nodes.length == 0) {
        return oNode.value;
    }
    // END opera fix
    for(var i=0; i < nodes.length; i++){
        var node = nodes[i];
        var nodeType = node.nodeType;
        if(nodeType == Node.TEXT_NODE || nodeType == Node.CDATA_SECTION_NODE){
            s += node.data;
        } else if(deep === true && (nodeType == Node.ELEMENT_NODE || nodeType == Node.DOCUMENT_NODE || nodeType == Node.DOCUMENT_FRAGMENT_NODE)){
            s += Sarissa.getText(node, true);
        }
    }
    return s;
};
if(Sarissa._SARISSA_IS_IE || !window.XMLSerializer && Sarissa.getDomDocument && Sarissa.getDomDocument("","foo", null).xml){
    /**
     * Utility class to serialize DOM Node objects to XML strings
     * @constructor
     */
    XMLSerializer = function(){};
    /**
     * Serialize the given DOM Node to an XML string
     * @param {DOMNode} oNode the DOM Node to serialize
     */
    XMLSerializer.prototype.serializeToString = function(oNode) {
        return oNode.xml;
    };
}

/**
 * Strips tags from the given markup string. If the given string is 
 * <code>undefined</code>, <code>null</code> or empty, it is returned as is. 
 * @memberOf Sarissa
 * @param {String} s the string to strip the tags from
 */
Sarissa.stripTags = function (s) {
    return s?s.replace(/<[^>]+>/g,""):s;
};
/**
 * <p>Deletes all child nodes of the given node</p>
 * @memberOf Sarissa
 * @param {DOMNode} oNode the Node to empty
 */
Sarissa.clearChildNodes = function(oNode) {
    // need to check for firstChild due to opera 8 bug with hasChildNodes
    while(oNode.firstChild) {
        oNode.removeChild(oNode.firstChild);
    }
};
/**
 * <p> Copies the childNodes of nodeFrom to nodeTo</p>
 * <p> <b>Note:</b> The second object's original content is deleted before 
 * the copy operation, unless you supply a true third parameter</p>
 * @memberOf Sarissa
 * @param {DOMNode} nodeFrom the Node to copy the childNodes from
 * @param {DOMNode} nodeTo the Node to copy the childNodes to
 * @param {boolean} bPreserveExisting whether to preserve the original content of nodeTo, default is false
 */
Sarissa.copyChildNodes = function(nodeFrom, nodeTo, bPreserveExisting) {
    if(Sarissa._SARISSA_IS_SAFARI && nodeTo.nodeType == Node.DOCUMENT_NODE){ // SAFARI_OLD ??
    	nodeTo = nodeTo.documentElement; //Apparently there's a bug in safari where you can't appendChild to a document node
    }
    
    if((!nodeFrom) || (!nodeTo)){
        throw "Both source and destination nodes must be provided";
    }
    if(!bPreserveExisting){
        Sarissa.clearChildNodes(nodeTo);
    }
    var ownerDoc = nodeTo.nodeType == Node.DOCUMENT_NODE ? nodeTo : nodeTo.ownerDocument;
    var nodes = nodeFrom.childNodes;
    var i;
    if(typeof(ownerDoc.importNode) != "undefined")  {
        for(i=0;i < nodes.length;i++) {
            nodeTo.appendChild(ownerDoc.importNode(nodes[i], true));
        }
    } else {
        for(i=0;i < nodes.length;i++) {
            nodeTo.appendChild(nodes[i].cloneNode(true));
        }
    }
};

/**
 * <p> Moves the childNodes of nodeFrom to nodeTo</p>
 * <p> <b>Note:</b> The second object's original content is deleted before 
 * the move operation, unless you supply a true third parameter</p>
 * @memberOf Sarissa
 * @param {DOMNode} nodeFrom the Node to copy the childNodes from
 * @param {DOMNode} nodeTo the Node to copy the childNodes to
 * @param {boolean} bPreserveExisting whether to preserve the original content of nodeTo, default is
 */ 
Sarissa.moveChildNodes = function(nodeFrom, nodeTo, bPreserveExisting) {
    if((!nodeFrom) || (!nodeTo)){
        throw "Both source and destination nodes must be provided";
    }
    if(!bPreserveExisting){
        Sarissa.clearChildNodes(nodeTo);
    }
    var nodes = nodeFrom.childNodes;
    // if within the same doc, just move, else copy and delete
    if(nodeFrom.ownerDocument == nodeTo.ownerDocument){
        while(nodeFrom.firstChild){
            nodeTo.appendChild(nodeFrom.firstChild);
        }
    } else {
        var ownerDoc = nodeTo.nodeType == Node.DOCUMENT_NODE ? nodeTo : nodeTo.ownerDocument;
        var i;
        if(typeof(ownerDoc.importNode) != "undefined") {
           for(i=0;i < nodes.length;i++) {
               nodeTo.appendChild(ownerDoc.importNode(nodes[i], true));
           }
        }else{
           for(i=0;i < nodes.length;i++) {
               nodeTo.appendChild(nodes[i].cloneNode(true));
           }
        }
        Sarissa.clearChildNodes(nodeFrom);
    }
};

/** 
 * <p>Serialize any <strong>non</strong> DOM object to an XML string. All properties are serialized using the property name
 * as the XML element name. Array elements are rendered as <code>array-item</code> elements, 
 * using their index/key as the value of the <code>key</code> attribute.</p>
 * @memberOf Sarissa
 * @param {Object} anyObject the object to serialize
 * @param {String} objectName a name for that object, to be used as the root element name
 * @param {String} indentSpace Optional, the indentation space to use, default is an empty 
 *        string. A single space character is added in any recursive call.
 * @param {noolean} skipEscape Optional, whether to skip escaping characters that map to the 
 *        five predefined XML entities. Default is <code>false</code>.
 * @return {String} the XML serialization of the given object as a string
 */
Sarissa.xmlize = function(anyObject, objectName, indentSpace, skipEscape){
    indentSpace = indentSpace?indentSpace:'';
    var s = indentSpace  + '<' + objectName + '>';
    var isLeaf = false;
    if(!(anyObject instanceof Object) || anyObject instanceof Number || anyObject instanceof String || anyObject instanceof Boolean || anyObject instanceof Date){
        s += (skipEscape ? Sarissa.escape(anyObject) : anyObject);
        isLeaf = true;
    }else{
        s += "\n";
        var isArrayItem = anyObject instanceof Array;
        for(var name in anyObject){
        	// do not xmlize functions 
        	if (anyObject[name] instanceof Function){
        		continue;
        	} 
            s += Sarissa.xmlize(anyObject[name], (isArrayItem?"array-item key=\""+name+"\"":name), indentSpace + " ");
        }
        s += indentSpace;
    }
    return (s += (objectName.indexOf(' ')!=-1?"</array-item>\n":"</" + objectName + ">\n"));
};

/** 
 * Escape the given string chacters that correspond to the five predefined XML entities
 * @memberOf Sarissa
 * @param {String} sXml the string to escape
 */
Sarissa.escape = function(sXml){
    return sXml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
};

/** 
 * Unescape the given string. This turns the occurences of the predefined XML 
 * entities to become the characters they represent correspond to the five predefined XML entities
 * @memberOf Sarissa
 * @param  {String}sXml the string to unescape
 */
Sarissa.unescape = function(sXml){
    return sXml.replace(/&apos;/g,"'").replace(/&quot;/g,"\"").replace(/&gt;/g,">").replace(/&lt;/g,"<").replace(/&amp;/g,"&");
};

/** @private */
Sarissa.updateCursor = function(oTargetElement, sValue) {
    if(oTargetElement && oTargetElement.style && oTargetElement.style.cursor != undefined ){
        oTargetElement.style.cursor = sValue;
    }
};

/**
 * Asynchronously update an element with response of a GET request on the given URL.  Passing a configured XSLT 
 * processor will result in transforming and updating oNode before using it to update oTargetElement.
 * You can also pass a callback function to be executed when the update is finished. The function will be called as 
 * <code>functionName(oNode, oTargetElement);</code>
 * @memberOf Sarissa
 * @param {String} sFromUrl the URL to make the request to
 * @param {DOMElement} oTargetElement the element to update
 * @param {XSLTProcessor} xsltproc (optional) the transformer to use on the returned
 *                  content before updating the target element with it
 * @param {Function} callback (optional) a Function object to execute once the update is finished successfuly, called as <code>callback(sFromUrl, oTargetElement)</code>. 
 *        In case an exception is thrown during execution, the callback is called as called as <code>callback(sFromUrl, oTargetElement, oException)</code>
 * @param {boolean} skipCache (optional) whether to skip any cache
 */
Sarissa.updateContentFromURI = function(sFromUrl, oTargetElement, xsltproc, callback, skipCache) {
    try{
        Sarissa.updateCursor(oTargetElement, "wait");
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.open("GET", sFromUrl, true);
        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState == 4) {
            	try{
            		var oDomDoc = xmlhttp.responseXML;
	            	if(oDomDoc && Sarissa.getParseErrorText(oDomDoc) == Sarissa.PARSED_OK){
		                Sarissa.updateContentFromNode(xmlhttp.responseXML, oTargetElement, xsltproc);
        				if(callback){
		                	callback(sFromUrl, oTargetElement);
		                }
	            	}
	            	else{
	            		throw Sarissa.getParseErrorText(oDomDoc);
	            	}
            	}
            	catch(e){
            		if(callback){
			        	callback(sFromUrl, oTargetElement, e);
			        }
			        else{
			        	throw e;
			        }
            	}
            }
        };
        if (skipCache) {
             var oldage = "Sat, 1 Jan 2000 00:00:00 GMT";
             xmlhttp.setRequestHeader("If-Modified-Since", oldage);
        }
        xmlhttp.send("");
    }
    catch(e){
        Sarissa.updateCursor(oTargetElement, "auto");
        if(callback){
        	callback(sFromUrl, oTargetElement, e);
        }
        else{
        	throw e;
        }
    }
};

/**
 * Update an element's content with the given DOM node. Passing a configured XSLT 
 * processor will result in transforming and updating oNode before using it to update oTargetElement.
 * You can also pass a callback function to be executed when the update is finished. The function will be called as 
 * <code>functionName(oNode, oTargetElement);</code>
 * @memberOf Sarissa
 * @param {DOMNode} oNode the URL to make the request to
 * @param {DOMElement} oTargetElement the element to update
 * @param {XSLTProcessor} xsltproc (optional) the transformer to use on the given 
 *                  DOM node before updating the target element with it
 */
Sarissa.updateContentFromNode = function(oNode, oTargetElement, xsltproc) {
    try {
        Sarissa.updateCursor(oTargetElement, "wait");
        Sarissa.clearChildNodes(oTargetElement);
        // check for parsing errors
        var ownerDoc = oNode.nodeType == Node.DOCUMENT_NODE?oNode:oNode.ownerDocument;
        if(ownerDoc.parseError && ownerDoc.parseError.errorCode != 0) {
            var pre = document.createElement("pre");
            pre.appendChild(document.createTextNode(Sarissa.getParseErrorText(ownerDoc)));
            oTargetElement.appendChild(pre);
        }
        else {
            // transform if appropriate
            if(xsltproc) {
                oNode = xsltproc.transformToDocument(oNode);
            }
            // be smart, maybe the user wants to display the source instead
            if(oTargetElement.tagName.toLowerCase() == "textarea" || oTargetElement.tagName.toLowerCase() == "input") {
                oTargetElement.value = new XMLSerializer().serializeToString(oNode);
            }
            else {
                // ok that was not smart; it was paranoid. Keep up the good work by trying to use DOM instead of innerHTML
                try{
                    oTargetElement.appendChild(oTargetElement.ownerDocument.importNode(oNode, true));
                }
                catch(e){
                    oTargetElement.innerHTML = new XMLSerializer().serializeToString(oNode);
                }
            }
        }
    }
    catch(e) {
    	throw e;
    }
    finally{
        Sarissa.updateCursor(oTargetElement, "auto");
    }
};


/**
 * Creates an HTTP URL query string from the given HTML form data
 * @memberOf Sarissa
 * @param {HTMLFormElement} oForm the form to construct the query string from
 */
Sarissa.formToQueryString = function(oForm){
    var qs = "";
    for(var i = 0;i < oForm.elements.length;i++) {
        var oField = oForm.elements[i];
        var sFieldName = oField.getAttribute("name") ? oField.getAttribute("name") : oField.getAttribute("id"); 
        // ensure we got a proper name/id and that the field is not disabled
        if(sFieldName && 
            ((!oField.disabled) || oField.type == "hidden")) {
            switch(oField.type) {
                case "hidden":
                case "text":
                case "textarea":
                case "password":
                    qs += sFieldName + "=" + encodeURIComponent(oField.value) + "&";
                    break;
                case "select-one":
                    qs += sFieldName + "=" + encodeURIComponent(oField.options[oField.selectedIndex].value) + "&";
                    break;
                case "select-multiple":
                    for (var j = 0; j < oField.length; j++) {
                        var optElem = oField.options[j];
                        if (optElem.selected === true) {
                            qs += sFieldName + "[]" + "=" + encodeURIComponent(optElem.value) + "&";
                        }
                     }
                     break;
                case "checkbox":
                case "radio":
                    if(oField.checked) {
                        qs += sFieldName + "=" + encodeURIComponent(oField.value) + "&";
                    }
                    break;
            }
        }
    }
    // return after removing last '&'
    return qs.substr(0, qs.length - 1); 
};


/**
 * Asynchronously update an element with response of an XMLHttpRequest-based emulation of a form submission. <p>The form <code>action</code> and 
 * <code>method</code> attributess will be followed. Passing a configured XSLT processor will result in 
 * transforming and updating the server response before using it to update the target element.
 * You can also pass a callback function to be executed when the update is finished. The function will be called as 
 * <code>functionName(oNode, oTargetElement);</code></p>
 * <p>Here is an example of using this in a form element:</p>
 * <pre name="code" class="xml">
 * &lt;div id="targetId"&gt; this content will be updated&lt;/div&gt;
 * &lt;form action="/my/form/handler" method="post" 
 *     onbeforesubmit="return Sarissa.updateContentFromForm(this, document.getElementById('targetId'));"&gt;<pre>
 * <p>If JavaScript is supported, the form will not be submitted. Instead, Sarissa will
 * scan the form and make an appropriate AJAX request, also adding a parameter 
 * to signal to the server that this is an AJAX call. The parameter is 
 * constructed as <code>Sarissa.REMOTE_CALL_FLAG = "=true"</code> so you can change the name in your webpage
 * simply by assigning another value to Sarissa.REMOTE_CALL_FLAG. If JavaScript is not supported
 * the form will be submitted normally.
 * @memberOf Sarissa
 * @param {HTMLFormElement} oForm the form submition to emulate
 * @param {DOMElement} oTargetElement the element to update
 * @param {XSLTProcessor} xsltproc (optional) the transformer to use on the returned
 *                  content before updating the target element with it
 * @param {Function} callback (optional) a Function object to execute once the update is finished successfuly, called as <code>callback(oNode, oTargetElement)</code>. 
 *        In case an exception occurs during excecution and a callback function was provided, the exception is cought and the callback is called as 
 *        <code>callback(oForm, oTargetElement, exception)</code>
 */
Sarissa.updateContentFromForm = function(oForm, oTargetElement, xsltproc, callback) {
    try{
    	Sarissa.updateCursor(oTargetElement, "wait");
        // build parameters from form fields
        var params = Sarissa.formToQueryString(oForm) + "&" + Sarissa.REMOTE_CALL_FLAG + "=true";
        var xmlhttp = new XMLHttpRequest();
        var bUseGet = oForm.getAttribute("method") && oForm.getAttribute("method").toLowerCase() == "get"; 
        if(bUseGet) {
            xmlhttp.open("GET", oForm.getAttribute("action")+"?"+params, true);
        }
        else{
            xmlhttp.open('POST', oForm.getAttribute("action"), true);
            xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            xmlhttp.setRequestHeader("Content-length", params.length);
            xmlhttp.setRequestHeader("Connection", "close");
        }
        xmlhttp.onreadystatechange = function() {
        	try{
	            if (xmlhttp.readyState == 4) {
	            	var oDomDoc = xmlhttp.responseXML;
	            	if(oDomDoc && Sarissa.getParseErrorText(oDomDoc) == Sarissa.PARSED_OK){
		                Sarissa.updateContentFromNode(xmlhttp.responseXML, oTargetElement, xsltproc);
        				if(callback){
		                	callback(oForm, oTargetElement);
		                }
	            	}
	            	else{
	            		throw Sarissa.getParseErrorText(oDomDoc);
	            	}
	            }
        	}
        	catch(e){
        		if(callback){
        			callback(oForm, oTargetElement, e);
        		}
        		else{
        			throw e;
        		}
        	}
        };
        xmlhttp.send(bUseGet?"":params);
    }
    catch(e){
        Sarissa.updateCursor(oTargetElement, "auto");
        if(callback){
        	callback(oForm, oTargetElement, e);
        }
        else{
        	throw e;
        }
    }
    return false;
};

/**
 * Get the name of a function created like:
 * <pre>function functionName(){}</pre>
 * If a name is not found, attach the function to 
 * the window object with a new name and return that
 * @param {Function} oFunc the function object
 */
Sarissa.getFunctionName = function(oFunc){
	if(!oFunc || (typeof oFunc != 'function' )){
		throw "The value of parameter 'oFunc' must be a function";
	}
	if(oFunc.name) { 
		return oFunc.name; 
	} 
	// try to parse the function name from the defintion 
	var sFunc = oFunc.toString(); 
	alert("sFunc: "+sFunc);
	var name = sFunc.substring(sFunc.indexOf('function') + 8 , sFunc.indexOf('(')); 
	if(!name || name.length == 0 || name == " "){
		// attach to window object under a new name
		name = "SarissaAnonymous" + Sarissa._getUniqueSuffix();
		window[name] = oFunc;
	}
	return name;
};

/**
 *
 */
Sarissa.setRemoteJsonCallback = function(url, callback, callbackParam) {
	if(!callbackParam){
		callbackParam = "callback";
	}
	var callbackFunctionName = Sarissa.getFunctionName(callback);
	//alert("callbackFunctionName: '" + callbackFunctionName+"', length: "+callbackFunctionName.length);
	var id = "sarissa_json_script_id_" + Sarissa._getUniqueSuffix(); 
	var oHead = document.getElementsByTagName("head")[0];
	var scriptTag = document.createElement('script');
	scriptTag.type = 'text/javascript';
	scriptTag.id = id;
	scriptTag.onload = function(){
		// cleanUp
		// document.removeChild(scriptTag);
	};
	if(url.indexOf("?") != -1){
		url += ("&" + callbackParam + "=" + callbackFunctionName);
	}
	else{
		url += ("?" + callbackParam + "=" + callbackFunctionName);
	}
	scriptTag.src = url;
  	oHead.appendChild(scriptTag);
  	return id;
};

//   EOF
module.exports.Sarissa = Sarissa;
});

/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/


/** @file Wrappers for the various navigation actions the user can do.
 * 
 * The assumption is that these should only be called in response to some event the user triggers, by clicking or whatever.
 * 
 * Provides {@link Numbas.controls}
 */

Numbas.queueScript('controls',['base','schedule'],function() {

var job = Numbas.schedule.add;

/** @namespace Numbas.controls */

Numbas.controls = /** @lends Numbas.controls */ {

	/** Start the exam - triggered when user clicks "Start" button on frontpage 
	 * @see Numbas.Exam#begin
	 */
	beginExam: function()
	{
		job(Numbas.exam.begin,Numbas.exam);
	},

	/** Pause the exam
	 * @see Numbas.Exam#pause
	 */
	pauseExam: function()
	{
		job(Numbas.exam.pause,Numbas.exam);
	},

	/** Resume the paused exam
	 * @see Numbas.Exam#resume
	 */
	resumeExam: function()
	{
		job(Numbas.exam.resume,Numbas.exam);
	},

	/** (Try to) end the exam
	 * @see Numbas.Exam#tryEnd
	 */
	endExam: function()
	{
		job(function() {
			Numbas.exam.tryEnd();
		});
	},

	/** In an ended exam, go back from reviewing a question the results page */
	backToResults: function()
	{
		job(function() {
			Numbas.exam.showInfoPage('result');
		});
	},

	/** "Exit" the exam - really this just shows the "You can close the browser" page
	 * @see Numbas.Exam#exit
	 */
	exitExam: function()
	{
		job(Numbas.exam.exit,Numbas.exam);
	},

	/** Try to move to the next question
	 * @see Numbas.Exam#tryChangeQuestion
	 */
	nextQuestion: function( )
	{
		job(function() {
			Numbas.exam.tryChangeQuestion( Numbas.exam.currentQuestion.number+1 );
		});
	},

	/** Try to move to the previous question
	 * @see Numbas.Exam#tryChangeQuestion
	 */
	previousQuestion: function()
	{
		job(function() {
			Numbas.exam.tryChangeQuestion( Numbas.exam.currentQuestion.number-1 );
		});
	},

	/** Make a function which tries to jump to question N
	 * @param {number} n - number of the question to jump to
	 * @returns {function}
	 * @see Numbas.controls.jumpQuestion
	 */
	makeQuestionJumper: function(n) {
		return function() {
			Numbas.controls.jumpQuestion(n);
		}
	},

	/* Try to move directly to a particular question
	 * @param {number} jumpTo - number of the question to jump to
	 * @see Numbas.Exam#tryChangeQuestion
	 */
	jumpQuestion: function( jumpTo )
	{
		job(function() {
			if(jumpTo == Numbas.exam.currentQuestion.number)
				return;

			Numbas.exam.tryChangeQuestion( jumpTo );
		});
	},

	/** Regenerate the current question
	 * @see Numbas.Exam#regenQuestion
	 */
	regenQuestion: function() 
	{
		job(function() {
			Numbas.display.showConfirm(R('control.confirm regen'),
				function(){Numbas.exam.regenQuestion();}
			);
		});
	},

	/** Show the advice for the current question
	 * @see Numbas.Question#getAdvice
	 */
	getAdvice: function()
	{
		job(Numbas.exam.currentQuestion.getAdvice,Numbas.exam.currentQuestion);
	},

	/** Reveal the answers to the current question
	 * @see Numbas.Question#revealAnswer
	 */
	revealAnswer: function()
	{
		job(function() {
			Numbas.display.showConfirm(R('control.confirm reveal'),
				function(){ Numbas.exam.currentQuestion.revealAnswer(); }
			);
		});
	},

	/** Submit student's answers to all parts in the current question
	 * @see Numbas.Question#submit
	 */
	submitQuestion: function()
	{
		job(Numbas.exam.currentQuestion.submit,Numbas.exam.currentQuestion);
	},

	/** Call when the student has changed their answer to a part
	 * @param {Array} answerList - student's answer
	 * @param {partpath} - id of the part being answered
	 * @see Numbas.Question#doPart
	 */
	doPart: function( answerList, partRef )
	{
		job(function() {
			Numbas.exam.currentQuestion.doPart(answerList, partRef);
		});
	},

	/* Show steps for a question part
	 * @param {partpath} partRef - id of the part
	 * @see Numbas.parts.Part#showSteps
	 */
	showSteps: function( partRef )
	{
		job(function() {
			Numbas.exam.currentQuestion.getPart(partRef).showSteps();
		});
	},

	/** Hide the steps for a question part
	 * @param {partpath} partRef - id of the part
	 * @see Numbas.parts.Part#hideSteps
	 */
	hideSteps: function( partRef )
	{
		job(function() {
			Numbas.exam.currentQuestion.getPart(partRef).hideSteps();
		});
	}
};

});

/*
Copyright 2011-14 Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/** @file Convenience functions, extensions to javascript built-ins, etc. Provides {@link Numbas.util}. Includes es5-shim.js */

Numbas.queueScript('util',['base','math'],function() {

/** @namespace Numbas.util */

var util = Numbas.util = /** @lends Numbas.util */ {

	/** Derive type B from A (class inheritance, really)
	 *
	 * B's prototype supercedes A's.
	 * @param {function} a - the constructor for the parent class
	 * @param {function} b - a constructor to be called after `a`'s constructor is done.
	 * @returns {function} a constructor for the derived class
	 */
	extend: function(a,b,extendMethods)
	{ 
		var c = function() 
		{ 
			a.apply(this,arguments);
			b.apply(this,arguments);
		};

		var x;
		for(x in a.prototype)
		{
			c.prototype[x]=a.prototype[x];
		}
		for(x in b.prototype)
		{
			c.prototype[x]=b.prototype[x];
		}

		if(extendMethods)
		{
			for(x in a.prototype)
			{
				if(typeof(a.prototype[x])=='function' && b.prototype[x])
					c.prototype[x]=Numbas.util.extend(a.prototype[x],b.prototype[x]);
			}
		}

		return c;
	},

	/** Clone an array, with array elements copied too.
	 * Array.splice() will create a copy of an array, but the elements are the same objects, which can cause fruity bugs.
	 * This function clones the array elements as well, so there should be no side-effects when operating on the cloned array.
	 * @param {Array} arr
	 * @param {boolean} deep - if true, do a deep copy of each element
	 * @see Numbas.util.copyobj
	 * @returns {Array}
	 */
	copyarray: function(arr,deep)
	{
		arr = arr.slice();
		if(deep)
		{
			for(var i=0;i<arr.length;i++)
			{
				arr[i]=util.copyobj(arr[i],deep);
			}
		}
		return arr;
	},

	/** Clone an object.
	 * @param {object} obj
	 * @param {boolean} deep - if true, each property is cloned as well (recursively) so there should be no side-effects when operating on the cloned object.
	 * @returns {object}
	 */
	copyobj: function(obj,deep)
	{
		switch(typeof(obj))
		{
		case 'object':
			if(obj===null)
				return obj;
			if(obj.length!==undefined)
			{
				return util.copyarray(obj,deep);
			}
			else
			{
				var newobj={};
				for(var x in obj)
				{
					if(deep)
						newobj[x] = util.copyobj(obj[x],deep);
					else
						newobj[x]=obj[x];
				}
				return newobj;
			}
		default:
			return obj;
		}
	},

	/** Shallow copy an object into an already existing object
	 * (add all src's properties to dest)
	 * @param {object} src
	 * @param {object} dest
	 */
	copyinto: function(src,dest)
	{
		for(var x in src)
		{
			if(dest[x]===undefined)
				dest[x]=src[x]
		}
	},

	/** Generic equality test on {@link Numbas.jme.token}s
	 * @param {Numbas.jme.token} a
	 * @param {Numbas.jme.token} b
	 * @returns {boolean}
	 */
	eq: function(a,b) {
		if(a.type != b.type)
			return false;
		if(a.type in util.equalityTests) {
			return util.equalityTests[a.type](a,b);
		} else {
			throw(new Numbas.Error('util.equality not defined for type %s',a.type));
		}
	},

	equalityTests: {
		'number': function(a,b) {
			return Numbas.math.eq(a.value,b.value);
		},
		'vector': function(a,b) {
			return Numbas.vectormath.eq(a.value,b.value);
		},
		'matrix': function(a,b) {
			return Numbas.matrixmath.eq(a.value,b.value);
		},
		'list': function(a,b) {
			return a.value.length==b.value.length && a.value.filter(function(ae,i){return !util.eq(ae,b.value[i])}).length==0;
		},
		'set': function(a,b) {
			return Numbas.setmath.eq(a.value,b.value);
		},
		'range': function(a,b) {
			return a.value[0]==b.value[0] && a.value[1]==b.value[1] && a.value[2]==b.value[2];
		},
		'name': function(a,b) {
			return a.name == b.name;
		},
		'string': function(a,b) {
			return a.value==b.value;
		},
		'boolean': function(a,b) {
			return a.value==b.value;
		},
	},


	/** Generic inequality test on {@link Numbas.jme.token}s
	 * @param {Numbas.jme.token} a
	 * @param {Numbas.jme.token} b
	 * @returns {boolean}
	 * @see Numbas.util.eq
	 */
	neq: function(a,b) {
		return !util.eq(a,b);
	},

	/** Filter out values in `exclude` from `list`
	 * @param {Numbas.jme.types.TList} list
	 * @param {Numbas.jme.types.TList} exclude
	 * @returns {Array}
	 */
	except: function(list,exclude) {
		return list.filter(function(l) {
			for(var i=0;i<exclude.length;i++) {
				if(util.eq(l,exclude[i]))
					return false;
			}
			return true;
		});
	},

	/** Return a copy of the input list with duplicates removed
	 * @param {array} list
	 * @returns {list}
	 * @see Numbas.util.eq
	 */
	distinct: function(list) {
		if(list.length==0) {
			return [];
		}
		var out = [list[0]];
		for(var i=1;i<list.length;i++) {
			var got = false;
			for(var j=0;j<out.length;j++) {
				if(util.eq(list[i],out[j])) {
					got = true;
					break;
				}
			}
			if(!got) {
				out.push(list[i]);
			}
		}
		return out;
	},

	/** Is value in the list?
	 * @param {array} list
	 * @param {Numbas.jme.token} value
	 * @returns {boolean}
	 */
	contains: function(list,value) {
		for(var i=0;i<list.length;i++) {
			if(util.eq(value,list[i])) {
				return true;
			}
		}
		return false;
	},

	/** Test if parameter is an integer
	 * @param {object} i
	 * @returns {boolean}
	 */
	isInt: function(i)
	{
		return parseInt(i,10)==i;
	},

	/** Test if parameter is a float
	 * @param {object} f
	 * @returns {boolean}
	 */
	isFloat: function(f)
	{
		return parseFloat(f)==f;
	},

	/** Is `n` a number? i.e. `!isNaN(n)`, or is `n` "infinity", or if `allowFractions` is true, is `n` a fraction?
	 * @param {number} n
	 * @param {boolean} allowFractions
	 * @returns {boolean}
	 */
	isNumber: function(n,allowFractions) {
		if(!isNaN(n)) {
			return true;
		}
		n = n.toString().trim();
		if(/-?infinity/i.test(n)) {
			return true;
		} else if(allowFractions && util.re_fraction.test(n)) {
			return true;
		} else {
			return false;
		}
	},

	/** Wrap a list index so -1 maps to length-1
	 * @param {number} n
	 * @param {number} size
	 * @returns {number}
	 */
	wrapListIndex: function(n,size) {
		if(n<0) {
			n += size;
		}
		return n;
	},

	/** Test if parameter is a boolean - that is: a boolean literal, or any of the strings 'false','true','yes','no', case-insensitive.
	 * @param {object} b
	 * @returns {boolean}
	 */
	isBool: function(b)
	{
		if(b==null) { return false; }
		if(typeof(b)=='boolean') { return true; }

		b = b.toString().toLowerCase();
		return b=='false' || b=='true' || b=='yes' || b=='no';
	},

	/** Parse a string as HTML, and return true only if it contains non-whitespace text
	 * @param {string} html
	 * @returns {boolean}
	 */
	isNonemptyHTML: function(html) {
		var d = document.createElement('div');
		d.innerHTML = html;
		return $(d).text().trim().length>0;
	},

	/** Parse parameter as a boolean. The boolean value `true` and the strings 'true' and 'yes' are parsed as the value `true`, everything else is `false`.
	 * @param {object} b
	 * @returns {boolean}
	 */
	parseBool: function(b)
	{
		if(!b)
			return false;
		b = b.toString().toLowerCase();
		return( b=='true' || b=='yes' );
	},

	/** Regular expression recognising a fraction */
	re_fraction: /^\s*(-?)\s*(\d+)\s*\/\s*(\d+)\s*/,

	/** Parse a number - either parseFloat, or parse a fraction
	 * @param {string} s
	 * @returns {number}
	 */
	parseNumber: function(s,allowFractions) {
		s = s.toString().trim();
		var m;
		if(util.isFloat(s)) {
			return parseFloat(s);
		} else if(s.toLowerCase()=='infinity') {
			return Infinity;
		} else if(s.toLowerCase()=='-infinity') {
			return -Infinity;
		} else if(allowFractions && (m = util.re_fraction.exec(s))) {
			var n = parseInt(m[2])/parseInt(m[3]);
			return m[1] ? -n : n;
		} else {
			return NaN;
		}
	},

	/** Pad string `s` on the left with a character `p` until it is `n` characters long.
	 * @param {string} s
	 * @param {number} n
	 * @param {string} p
	 * @returns {string}
	 */
	lpad: function(s,n,p)
	{
		s=s.toString();
		p=p[0];
		while(s.length<n) { s=p+s; }
		return s;
	},

	/** Replace occurences of `%s` with the extra arguments of the function
	 * @example formatString('hello %s %s','Mr.','Perfect') => 'hello Mr. Perfect'
	 * @param {string} str
	 * @param {...string} value - string to substitute
	 * @returns {string}
	 */
	formatString: function(str)
	{
		var i=0;
		for(var i=1;i<arguments.length;i++)
		{
			str=str.replace(/%s/,arguments[i]);
		}
		return str;
	},

	/** Format an amount of currency
	 * @example currency(5.3,'£','p') => £5.30
	 * @param {number} n
	 * @param {string} prefix - symbol to use in front of currency if abs(n) >= 1
	 * @param {string} suffix - symbol to use in front of currency if abs(n) <= 1
	 */
	currency: function(n,prefix,suffix) {
		if(n<0)
			return '-'+util.currency(-n,prefix,suffix);
		else if(n==0) {
			return prefix+'0';
		}

		var s = Numbas.math.niceNumber(Math.floor(100*n));
		if(Math.abs(n)>=1) {
			if(n%1<0.005)
				return prefix+Numbas.math.niceNumber(n);
			s = s.replace(/(..)$/,'.$1');
			return prefix+s
		} else {
			return s+suffix;
		}
	},

	/** Get rid of the % on the end of percentages and parse as float, then divide by 100
	 * @example unPercent('50%') => 0.5
	 * @example unPercent('50') => 0.5
	 * @param {string} s
	 * @returns {number}
	 */
	unPercent: function(s)
	{
		return (parseFloat(s.replace(/%/,''))/100);
	},


	/** Pluralise a word
	 * 
	 * If `n` is not unity, return `plural`, else return `singular`
	 * @param {number} n
	 * @param {string} singular - string to return if `n` is +1 or -1
	 * @param {string} plural - string to returns if `n` is not +1 or -1
	 * @returns {string}
	 */
	pluralise: function(n,singular,plural)
	{
		n = Numbas.math.precround(n,10);
		if(n==-1 || n==1)
			return singular;
		else
			return plural;
	},

	/** Make the first letter in the string a capital
	 * @param {string} str
	 * @returns {string}
	 */
	capitalise: function(str) {
		return str.replace(/^[a-z]/,function(c){return c.toUpperCase()});
	},

	/** Split a string up according to brackets
	 *
	 * Strips out nested brackets
	 * @example splitbrackets('a{{b}}c','{','}') => ['a','b','c']
	 * @param {string} t - string to split
	 * @param {string} lb - left bracket character
	 * @param {string} rb - right bracket character
	 * @returns {string[]} - alternating strings in brackets and strings outside: odd-numbered indices are inside brackets.
	 */
	splitbrackets: function(t,lb,rb)
	{
		var o=[];
		var l=t.length;
		var s=0;
		var depth=0;
		for(var i=0;i<l;i++)
		{
			if(t.charAt(i)==lb && !(i>0 && t.charAt(i-1)=='\\'))
			{
				depth+=1;
				if(depth==1)
				{
					o.push(t.slice(s,i));
					s=i+1;
				}
				else
				{
					t = t.slice(0,i)+t.slice(i+1);
					i-=1;
				}
			}
			else if(depth>0 && t.charAt(i)==rb && !(i>0 && t.charAt(i-1)=='\\'))
			{
				depth-=1;
				if(depth==0)
				{
					o.push(t.slice(s,i));
					s=i+1;
				}
				else
				{
					t = t.slice(0,i)+t.slice(i+1);
					i -= 1;
				}
			}
		}
		if(s<l)
			o.push(t.slice(s));
		return o;
	},

	/** Because XML doesn't like having ampersands hanging about, replace them with escape codes
	 * @param {string} str - XML string
	 * @returns {string}
	 */
	escapeHTML: function(str)
	{
		return str.replace(/&/g,'&amp;');
	},

	/** Create a comparison function which sorts objects by a particular property
	 * @param {string} prop - name of the property to sort by
	 * @returns {function}
	 */
	sortBy: function(prop) {
		return function(a,b) {
			if(a[prop]>b[prop])
				return 1;
			else if(a[prop]<b[prop])
				return -1;
			else
				return 0;
		}
	},

	/** Hash a string into a string of digits
	 * 
	 * From {@link http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/}
	 */
	hashCode: function(str){
		var hash = 0, i, c;
		if (str.length == 0) return hash;
		for (i = 0; i < str.length; i++) {
			c = str.charCodeAt(i);
			hash = ((hash<<5)-hash)+c;
		}
		if(hash<0)
			return '0'+(-hash);
		else
			return '1'+hash;
	},

	/** Cartesian product of one or more lists
	 * @param {array} lists - list of arrays
	 * @returns {array}
	 */
	product: function(lists) {
		var indexes = lists.map(function(){return 0});
		var lengths = lists.map(function(l){return l.length});
		var end = lists.length-1;

		var out = [];
		while(indexes[0]!=lengths[0]) {
			out.push(indexes.map(function(i,n){return lists[n][i]}));
			var k = end;
			indexes[k] += 1;
			while(k>0 && indexes[k]==lengths[k]) {
				indexes[k] = 0;
				k -= 1;
				indexes[k] += 1;
			}
		}
		return out;
	},

	/** All combinations of r items from given array, without replacement
	 * @param {array} list
	 * @param {number} r
	 */
	combinations: function(list,r) {
		var indexes = [];
		for(var i=0;i<r;i++) {
			indexes.push(i);
		}
		var length = list.length;
		var end = r-1;

		var out = [];
		var steps = 0;
		while(steps<1000 && indexes[0]<length+1-r) {
			steps += 1;

			out.push(indexes.map(function(i){return list[i]; }));
			indexes[end] += 1;
			if(indexes[end]==length) {
				var k = end;
				while(k>=0 && indexes[k]==length+1-r+k) {
					k -= 1;
					indexes[k] += 1;
				}
				for(k=k+1;k<r;k++) {
					indexes[k] = indexes[k-1]+1;
				}
			}
		}
		return out;
	},

	
	/** All combinations of r items from given array, with replacement
	 * @param {array} list
	 * @param {number} r
	 */
	combinations_with_replacement: function(list,r) {
		var indexes = [];
		for(var i=0;i<r;i++) {
			indexes.push(0);
		}
		var length = list.length;
		var end = r-1;

		var out = [];
		while(indexes[0]<length) {
			out.push(indexes.map(function(i){return list[i]; }));
			indexes[end] += 1;
			if(indexes[end]==length) {
				var k = end;
				while(k>=0 && indexes[k]==length) {
					k -= 1;
					indexes[k] += 1;
				}
				for(k=k+1;k<r;k++) {
					indexes[k] = indexes[k-1];
				}
			}
		}
		return out;
	},


	/** All permutations of all choices of r elements from list
	 *
	 * Inspired by the algorithm in Python's itertools library
	 * @param {array} list - elements to choose and permute
	 * @param {number} r - number of elements to choose
	 */
	permutations: function(list,r) {
		var n = list.length;
		if(r===undefined) {
			r = n;
		}
		var indices = [];
		var cycles = [];
		for(var i=0;i<n;i++) {
			indices.push(i);
		}
		for(var i=n;i>=n-r+1;i--) {
			cycles.push(i);
		}

		var out = [indices.slice(0,r).map(function(v){return list[v]})];

		while(n) {
			for(var i=r-1;i>=0;i--) {
				cycles[i] -= 1
				if(cycles[i]==0) {
					indices.push(indices.splice(i,1)[0]);
					cycles[i] = n-i
				} else {
					var j = cycles[i];
					var t = indices[i];
					indices[i] = indices[n-j];
					indices[n-j] = t;
					out.push(indices.slice(0,r).map(function(v){return list[v]}));
					break;
				}
			}
			if(i==-1) {
				return out;
			}
		}
	}
	
};

var endDelimiters = {
    '$': /[^\\]\$/,
    '\\(': /[^\\]\\\)/,
    '$$': /[^\\]\$\$/,
    '\\[': /[^\\]\\\]/
}
var re_startMaths = /(?:^|[^\\])\$\$|(?:^|[^\\])\$|\\\(|\\\[|\\begin\{(\w+)\}/;

/** Split a string up by TeX delimiters (`$`, `\[`, `\]`)
 *
 * `bits.re_end` stores the delimiter if the returned array has unfinished maths at the end
 * @param {string} txt - string to split up
 * @param {RegExp} re_end - If tex is split across several strings (e.g. text nodes with <br> in the middle), this can be used to give the end delimiter for unfinished maths 
 * @returns {string[]} bits - stuff outside TeX, left delimiter, TeX, right delimiter, stuff outside TeX, ...
 * @example contentsplitbrackets('hello $x+y$ and \[this\] etc') => ['hello ','$','x+y','$',' and ','\[','this','\]']
 * @memberof Numbas.util
 * @method
 */
var contentsplitbrackets = util.contentsplitbrackets = function(txt,re_end) {
    var i = 0;
    var m;
    var startDelimiter='', endDelimiter='';
	var startText = '';
    var start='', end='';
    var startChop, endChop;
    var re_end;
	var bits = [];
	
    while(txt.length) {
		if(!re_end) {
			m = re_startMaths.exec(txt);
			
			if(!m) {     // if no maths delimiters, we're done
				bits.push(txt);
				txt = '';
				break;
			}
			
			startDelimiter = m[0];
			var start = m.index;
			
			startChop = start+startDelimiter.length;
			startText = txt.slice(0,start);
			txt = txt.slice(startChop);

			if(startDelimiter.match(/^\\begin/m)) {    //if this is an environment, construct a regexp to find the corresponding \end{} command.
				var environment = m[1];
				re_end = new RegExp('[^\\\\]\\\\end\\{'+environment+'\\}');    // don't ask if this copes with nested environments
			}
			else if(startDelimiter.match(/^(?:.|[\r\n])\$/m)) {
				re_end = endDelimiters[startDelimiter.slice(1)];
			} else {
				re_end = endDelimiters[startDelimiter];    // get the corresponding end delimiter for the matched start delimiter
			}
		}
        
        m = re_end.exec(txt);
        
        if(!m) {    // if no ending delimiter, the text contains no valid maths
			bits.push(startText,startDelimiter,txt);
			bits.re_end = re_end;
			txt = '';
			break;
        }
        
        endDelimiter = m[0].slice(1);
        var end = m.index+1;    // the end delimiter regexp has a "not a backslash" character at the start because JS regexps don't do negative lookbehind
        endChop = end+endDelimiter.length;
		var math = txt.slice(0,end);
		txt = txt.slice(endChop);
		i += startChop+endChop;

		bits.push(startText,startDelimiter,math,endDelimiter);
		re_end = null;
    }
	return bits;
}

//Because indexOf not supported in IE
if(!Array.indexOf)
{
	Array.prototype.indexOf = function(obj){
		for(var i=0; i<this.length; i++){
			if(this[i]==obj){
				return i;
			}
		}
		return -1;
	};
}

//nice short 'string contains' function
if(!String.prototype.contains)
{
	String.prototype.contains = function(it) { return this.indexOf(it) != -1; };
}
if(!Array.prototype.contains)
{
	Array.prototype.contains = function(it) { return this.indexOf(it) != -1; };
}

//merge one array into another, only adding elements which aren't already present
if(!Array.prototype.merge)
{
	Array.prototype.merge = function(arr,sortfn)
	{
		if(this.length==0)
			return arr.slice();

		var out = this.concat(arr);
		if(sortfn)
			out.sort(sortfn);
		else
			out.sort();
		if(sortfn) 
		{
			for(var i=1; i<out.length;) {
				if(sortfn(out[i-1],out[i])==0)	//duplicate elements, so remove latest
					out.splice(i,1);
				else
					i++;
			}
		}
		else
		{
			for(var i=1;i<out.length;) {
				if(out[i-1]==out[i])
					out.splice(i,1);
				else
					i++;
			}
		}

		return out;
	};
}

/* Cross-Browser Split 1.0.1
(c) Steven Levithan <stevenlevithan.com>; MIT License
An ECMA-compliant, uniform cross-browser split method */

var cbSplit;

// avoid running twice, which would break `cbSplit._nativeSplit`'s reference to the native `split`
if (!cbSplit) {

cbSplit = function (str, separator, limit) {
    // if `separator` is not a regex, use the native `split`
    if (Object.prototype.toString.call(separator) !== "[object RegExp]") {
        return cbSplit._nativeSplit.call(str, separator, limit);
    }

    var output = [],
        lastLastIndex = 0,
        flags = (separator.ignoreCase ? "i" : "") +
                (separator.multiline  ? "m" : "") +
                (separator.sticky     ? "y" : ""),
        separator = RegExp(separator.source, flags + "g"), // make `global` and avoid `lastIndex` issues by working with a copy
        separator2, match, lastIndex, lastLength;

    str = str + ""; // type conversion
    if (!cbSplit._compliantExecNpcg) {
        separator2 = RegExp("^" + separator.source + "$(?!\\s)", flags); // doesn't need /g or /y, but they don't hurt
    }

    /* behavior for `limit`: if it's...
    - `undefined`: no limit.
    - `NaN` or zero: return an empty array.
    - a positive number: use `Math.floor(limit)`.
    - a negative number: no limit.
    - other: type-convert, then use the above rules. */
    if (limit === undefined || +limit < 0) {
        limit = Infinity;
    } else {
        limit = Math.floor(+limit);
        if (!limit) {
            return [];
        }
    }

    while (match = separator.exec(str)) {
        lastIndex = match.index + match[0].length; // `separator.lastIndex` is not reliable cross-browser

        if (lastIndex > lastLastIndex) {
            output.push(str.slice(lastLastIndex, match.index));

            // fix browsers whose `exec` methods don't consistently return `undefined` for nonparticipating capturing groups
            if (!cbSplit._compliantExecNpcg && match.length > 1) {
                match[0].replace(separator2, function () {
                    for (var i = 1; i < arguments.length - 2; i++) {
                        if (arguments[i] === undefined) {
                            match[i] = undefined;
                        }
                    }
                });
            }

            if (match.length > 1 && match.index < str.length) {
                Array.prototype.push.apply(output, match.slice(1));
            }

            lastLength = match[0].length;
            lastLastIndex = lastIndex;

            if (output.length >= limit) {
                break;
            }
        }

        if (separator.lastIndex === match.index) {
            separator.lastIndex++; // avoid an infinite loop
        }
    }

    if (lastLastIndex === str.length) {
        if (lastLength || !separator.test("")) {
            output.push("");
        }
    } else {
        output.push(str.slice(lastLastIndex));
    }

    return output.length > limit ? output.slice(0, limit) : output;
};

cbSplit._compliantExecNpcg = /()??/.exec("")[1] === undefined; // NPCG: nonparticipating capturing group
cbSplit._nativeSplit = String.prototype.split;

} // end `if (!cbSplit)`

// for convenience, override the builtin split function with the cross-browser version...
if(!String.prototype.split)
{
	String.prototype.split = function (separator, limit) {
		return cbSplit(this, separator, limit);
	};
}


// es5-shim.min.js 24/09/2012
//
// -- kriskowal Kris Kowal Copyright (C) 2009-2011 MIT License
// -- tlrobinson Tom Robinson Copyright (C) 2009-2010 MIT License (Narwhal Project)
// -- dantman Daniel Friesen Copyright (C) 2010 XXX TODO License or CLA
// -- fschaefer Florian Schäfer Copyright (C) 2010 MIT License
// -- Gozala Irakli Gozalishvili Copyright (C) 2010 MIT License
// -- kitcambridge Kit Cambridge Copyright (C) 2011 MIT License
// -- kossnocorp Sasha Koss XXX TODO License or CLA
// -- bryanforbes Bryan Forbes XXX TODO License or CLA
// -- killdream Quildreen Motta Copyright (C) 2011 MIT Licence
// -- michaelficarra Michael Ficarra Copyright (C) 2011 3-clause BSD License
// -- sharkbrainguy Gerard Paapu Copyright (C) 2011 MIT License
// -- bbqsrc Brendan Molloy (C) 2011 Creative Commons Zero (public domain)
// -- iwyg XXX TODO License or CLA
// -- DomenicDenicola Domenic Denicola Copyright (C) 2011 MIT License
// -- xavierm02 Montillet Xavier Copyright (C) 2011 MIT License
// -- Raynos Jake Verbaten Copyright (C) 2011 MIT Licence
// -- samsonjs Sami Samhuri Copyright (C) 2010 MIT License
// -- rwldrn Rick Waldron Copyright (C) 2011 MIT License
// -- lexer Alexey Zakharov XXX TODO License or CLA

/*!
    Copyright (c) 2009, 280 North Inc. http://280north.com/
    MIT License. http://github.com/280north/narwhal/blob/master/README.md
*/
// Module systems magic dance
(function (definition) {
    // RequireJS
    if (typeof define == "function") {
        define(definition);
    // CommonJS and <script>
    } else {
        definition();
    }
})(function () {

/**
 * Brings an environment as close to ECMAScript 5 compliance
 * as is possible with the facilities of erstwhile engines.
 *
 * Annotated ES5: http://es5.github.com/ (specific links below)
 * ES5 Spec: http://www.ecma-international.org/publications/files/ECMA-ST/Ecma-262.pdf
 * Required reading: http://javascriptweblog.wordpress.com/2011/12/05/extending-javascript-natives/
 */

//
// Function
// ========
//

// ES-5 15.3.4.5
// http://es5.github.com/#x15.3.4.5

if (!Function.prototype.bind) {
    Function.prototype.bind = function bind(that) { // .length is 1
        // 1. Let Target be the this value.
        var target = this;
        // 2. If IsCallable(Target) is false, throw a TypeError exception.
        if (typeof target != "function") {
            throw new TypeError("Function.prototype.bind called on incompatible " + target);
        }
        // 3. Let A be a new (possibly empty) internal list of all of the
        //   argument values provided after thisArg (arg1, arg2 etc), in order.
        // XXX slicedArgs will stand in for "A" if used
        var args = slice.call(arguments, 1); // for normal call
        // 4. Let F be a new native ECMAScript object.
        // 11. Set the [[Prototype]] internal property of F to the standard
        //   built-in Function prototype object as specified in 15.3.3.1.
        // 12. Set the [[Call]] internal property of F as described in
        //   15.3.4.5.1.
        // 13. Set the [[Construct]] internal property of F as described in
        //   15.3.4.5.2.
        // 14. Set the [[HasInstance]] internal property of F as described in
        //   15.3.4.5.3.
        var bound = function () {

            if (this instanceof bound) {
                // 15.3.4.5.2 [[Construct]]
                // When the [[Construct]] internal method of a function object,
                // F that was created using the bind function is called with a
                // list of arguments ExtraArgs, the following steps are taken:
                // 1. Let target be the value of F's [[TargetFunction]]
                //   internal property.
                // 2. If target has no [[Construct]] internal method, a
                //   TypeError exception is thrown.
                // 3. Let boundArgs be the value of F's [[BoundArgs]] internal
                //   property.
                // 4. Let args be a new list containing the same values as the
                //   list boundArgs in the same order followed by the same
                //   values as the list ExtraArgs in the same order.
                // 5. Return the result of calling the [[Construct]] internal
                //   method of target providing args as the arguments.

                var F = function(){};
                F.prototype = target.prototype;
                var self = new F;

                var result = target.apply(
                    self,
                    args.concat(slice.call(arguments))
                );
                if (Object(result) === result) {
                    return result;
                }
                return self;

            } else {
                // 15.3.4.5.1 [[Call]]
                // When the [[Call]] internal method of a function object, F,
                // which was created using the bind function is called with a
                // this value and a list of arguments ExtraArgs, the following
                // steps are taken:
                // 1. Let boundArgs be the value of F's [[BoundArgs]] internal
                //   property.
                // 2. Let boundThis be the value of F's [[BoundThis]] internal
                //   property.
                // 3. Let target be the value of F's [[TargetFunction]] internal
                //   property.
                // 4. Let args be a new list containing the same values as the
                //   list boundArgs in the same order followed by the same
                //   values as the list ExtraArgs in the same order.
                // 5. Return the result of calling the [[Call]] internal method
                //   of target providing boundThis as the this value and
                //   providing args as the arguments.

                // equiv: target.call(this, ...boundArgs, ...args)
                return target.apply(
                    that,
                    args.concat(slice.call(arguments))
                );

            }

        };
        // XXX bound.length is never writable, so don't even try
        //
        // 15. If the [[Class]] internal property of Target is "Function", then
        //     a. Let L be the length property of Target minus the length of A.
        //     b. Set the length own property of F to either 0 or L, whichever is
        //       larger.
        // 16. Else set the length own property of F to 0.
        // 17. Set the attributes of the length own property of F to the values
        //   specified in 15.3.5.1.

        // TODO
        // 18. Set the [[Extensible]] internal property of F to true.

        // TODO
        // 19. Let thrower be the [[ThrowTypeError]] function Object (13.2.3).
        // 20. Call the [[DefineOwnProperty]] internal method of F with
        //   arguments "caller", PropertyDescriptor {[[Get]]: thrower, [[Set]]:
        //   thrower, [[Enumerable]]: false, [[Configurable]]: false}, and
        //   false.
        // 21. Call the [[DefineOwnProperty]] internal method of F with
        //   arguments "arguments", PropertyDescriptor {[[Get]]: thrower,
        //   [[Set]]: thrower, [[Enumerable]]: false, [[Configurable]]: false},
        //   and false.

        // TODO
        // NOTE Function objects created using Function.prototype.bind do not
        // have a prototype property or the [[Code]], [[FormalParameters]], and
        // [[Scope]] internal properties.
        // XXX can't delete prototype in pure-js.

        // 22. Return F.
        return bound;
    };
}

// Shortcut to an often accessed properties, in order to avoid multiple
// dereference that costs universally.
// _Please note: Shortcuts are defined after `Function.prototype.bind` as we
// us it in defining shortcuts.
var call = Function.prototype.call;
var prototypeOfArray = Array.prototype;
var prototypeOfObject = Object.prototype;
var slice = prototypeOfArray.slice;
// Having a toString local variable name breaks in Opera so use _toString.
var _toString = call.bind(prototypeOfObject.toString);
var owns = call.bind(prototypeOfObject.hasOwnProperty);

// If JS engine supports accessors creating shortcuts.
var defineGetter;
var defineSetter;
var lookupGetter;
var lookupSetter;
var supportsAccessors;
if ((supportsAccessors = owns(prototypeOfObject, "__defineGetter__"))) {
    defineGetter = call.bind(prototypeOfObject.__defineGetter__);
    defineSetter = call.bind(prototypeOfObject.__defineSetter__);
    lookupGetter = call.bind(prototypeOfObject.__lookupGetter__);
    lookupSetter = call.bind(prototypeOfObject.__lookupSetter__);
}

//
// Array
// =====
//

// ES5 15.4.3.2
// http://es5.github.com/#x15.4.3.2
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/isArray
if (!Array.isArray) {
    Array.isArray = function isArray(obj) {
        return _toString(obj) == "[object Array]";
    };
}

// The IsCallable() check in the Array functions
// has been replaced with a strict check on the
// internal class of the object to trap cases where
// the provided function was actually a regular
// expression literal, which in V8 and
// JavaScriptCore is a typeof "function".  Only in
// V8 are regular expression literals permitted as
// reduce parameters, so it is desirable in the
// general case for the shim to match the more
// strict and common behavior of rejecting regular
// expressions.

// ES5 15.4.4.18
// http://es5.github.com/#x15.4.4.18
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/array/forEach
if (!Array.prototype.forEach) {
    Array.prototype.forEach = function forEach(fun /*, thisp*/) {
        var self = toObject(this),
            thisp = arguments[1],
            i = -1,
            length = self.length >>> 0;

        // If no callback function or if callback is not a callable function
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(); // TODO message
        }

        while (++i < length) {
            if (i in self) {
                // Invoke the callback function with call, passing arguments:
                // context, property value, property key, thisArg object context
                fun.call(thisp, self[i], i, self);
            }
        }
    };
}

// ES5 15.4.4.19
// http://es5.github.com/#x15.4.4.19
// https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/map
if (!Array.prototype.map) {
    Array.prototype.map = function map(fun /*, thisp*/) {
        var self = toObject(this),
            length = self.length >>> 0,
            result = Array(length),
            thisp = arguments[1];

        // If no callback function or if callback is not a callable function
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }

        for (var i = 0; i < length; i++) {
            if (i in self)
                result[i] = fun.call(thisp, self[i], i, self);
        }
        return result;
    };
}

// ES5 15.4.4.20
// http://es5.github.com/#x15.4.4.20
// https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/filter
if (!Array.prototype.filter) {
    Array.prototype.filter = function filter(fun /*, thisp */) {
        var self = toObject(this),
            length = self.length >>> 0,
            result = [],
            value,
            thisp = arguments[1];

        // If no callback function or if callback is not a callable function
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }

        for (var i = 0; i < length; i++) {
            if (i in self) {
                value = self[i];
                if (fun.call(thisp, value, i, self)) {
                    result.push(value);
                }
            }
        }
        return result;
    };
}

// ES5 15.4.4.16
// http://es5.github.com/#x15.4.4.16
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/every
if (!Array.prototype.every) {
    Array.prototype.every = function every(fun /*, thisp */) {
        var self = toObject(this),
            length = self.length >>> 0,
            thisp = arguments[1];

        // If no callback function or if callback is not a callable function
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }

        for (var i = 0; i < length; i++) {
            if (i in self && !fun.call(thisp, self[i], i, self)) {
                return false;
            }
        }
        return true;
    };
}

// ES5 15.4.4.17
// http://es5.github.com/#x15.4.4.17
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/some
if (!Array.prototype.some) {
    Array.prototype.some = function some(fun /*, thisp */) {
        var self = toObject(this),
            length = self.length >>> 0,
            thisp = arguments[1];

        // If no callback function or if callback is not a callable function
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }

        for (var i = 0; i < length; i++) {
            if (i in self && fun.call(thisp, self[i], i, self)) {
                return true;
            }
        }
        return false;
    };
}

// ES5 15.4.4.21
// http://es5.github.com/#x15.4.4.21
// https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/reduce
if (!Array.prototype.reduce) {
    Array.prototype.reduce = function reduce(fun /*, initial*/) {
        var self = toObject(this),
            length = self.length >>> 0;

        // If no callback function or if callback is not a callable function
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }

        // no value to return if no initial value and an empty array
        if (!length && arguments.length == 1) {
            throw new TypeError('reduce of empty array with no initial value');
        }

        var i = 0;
        var result;
        if (arguments.length >= 2) {
            result = arguments[1];
        } else {
            do {
                if (i in self) {
                    result = self[i++];
                    break;
                }

                // if array contains no values, no initial value to return
                if (++i >= length) {
                    throw new TypeError('reduce of empty array with no initial value');
                }
            } while (true);
        }

        for (; i < length; i++) {
            if (i in self) {
                result = fun.call(void 0, result, self[i], i, self);
            }
        }

        return result;
    };
}

// ES5 15.4.4.22
// http://es5.github.com/#x15.4.4.22
// https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/reduceRight
if (!Array.prototype.reduceRight) {
    Array.prototype.reduceRight = function reduceRight(fun /*, initial*/) {
        var self = toObject(this),
            length = self.length >>> 0;

        // If no callback function or if callback is not a callable function
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }

        // no value to return if no initial value, empty array
        if (!length && arguments.length == 1) {
            throw new TypeError('reduceRight of empty array with no initial value');
        }

        var result, i = length - 1;
        if (arguments.length >= 2) {
            result = arguments[1];
        } else {
            do {
                if (i in self) {
                    result = self[i--];
                    break;
                }

                // if array contains no values, no initial value to return
                if (--i < 0) {
                    throw new TypeError('reduceRight of empty array with no initial value');
                }
            } while (true);
        }

        do {
            if (i in this) {
                result = fun.call(void 0, result, self[i], i, self);
            }
        } while (i--);

        return result;
    };
}

// ES5 15.4.4.14
// http://es5.github.com/#x15.4.4.14
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/indexOf
if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function indexOf(sought /*, fromIndex */ ) {
        var self = toObject(this),
            length = self.length >>> 0;

        if (!length) {
            return -1;
        }

        var i = 0;
        if (arguments.length > 1) {
            i = toInteger(arguments[1]);
        }

        // handle negative indices
        i = i >= 0 ? i : Math.max(0, length + i);
        for (; i < length; i++) {
            if (i in self && self[i] === sought) {
                return i;
            }
        }
        return -1;
    };
}

// ES5 15.4.4.15
// http://es5.github.com/#x15.4.4.15
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/lastIndexOf
if (!Array.prototype.lastIndexOf) {
    Array.prototype.lastIndexOf = function lastIndexOf(sought /*, fromIndex */) {
        var self = toObject(this),
            length = self.length >>> 0;

        if (!length) {
            return -1;
        }
        var i = length - 1;
        if (arguments.length > 1) {
            i = Math.min(i, toInteger(arguments[1]));
        }
        // handle negative indices
        i = i >= 0 ? i : length - Math.abs(i);
        for (; i >= 0; i--) {
            if (i in self && sought === self[i]) {
                return i;
            }
        }
        return -1;
    };
}

//
// Object
// ======
//

// ES5 15.2.3.2
// http://es5.github.com/#x15.2.3.2
if (!Object.getPrototypeOf) {
    // https://github.com/kriskowal/es5-shim/issues#issue/2
    // http://ejohn.org/blog/objectgetprototypeof/
    // recommended by fschaefer on github
    Object.getPrototypeOf = function getPrototypeOf(object) {
        return object.__proto__ || (
            object.constructor
                ? object.constructor.prototype
                : prototypeOfObject
        );
    };
}

// ES5 15.2.3.3
// http://es5.github.com/#x15.2.3.3
if (!Object.getOwnPropertyDescriptor) {
    var ERR_NON_OBJECT = "Object.getOwnPropertyDescriptor called on a non-object: ";

    Object.getOwnPropertyDescriptor = function getOwnPropertyDescriptor(object, property) {
        if ((typeof object != "object" && typeof object != "function") || object === null) {
            throw new TypeError(ERR_NON_OBJECT + object);
        }
        // If object does not owns property return undefined immediately.
        if (!owns(object, property)) {
            return;
        }

        // If object has a property then it's for sure both `enumerable` and
        // `configurable`.
        var descriptor =  { enumerable: true, configurable: true };

        // If JS engine supports accessor properties then property may be a
        // getter or setter.
        if (supportsAccessors) {
            // Unfortunately `__lookupGetter__` will return a getter even
            // if object has own non getter property along with a same named
            // inherited getter. To avoid misbehavior we temporary remove
            // `__proto__` so that `__lookupGetter__` will return getter only
            // if it's owned by an object.
            var prototype = object.__proto__;
            object.__proto__ = prototypeOfObject;

            var getter = lookupGetter(object, property);
            var setter = lookupSetter(object, property);

            // Once we have getter and setter we can put values back.
            object.__proto__ = prototype;

            if (getter || setter) {
                if (getter) {
                    descriptor.get = getter;
                }
                if (setter) {
                    descriptor.set = setter;
                }
                // If it was accessor property we're done and return here
                // in order to avoid adding `value` to the descriptor.
                return descriptor;
            }
        }

        // If we got this far we know that object has an own property that is
        // not an accessor so we set it as a value and return descriptor.
        descriptor.value = object[property];
        return descriptor;
    };
}

// ES5 15.2.3.4
// http://es5.github.com/#x15.2.3.4
if (!Object.getOwnPropertyNames) {
    Object.getOwnPropertyNames = function getOwnPropertyNames(object) {
        return Object.keys(object);
    };
}

// ES5 15.2.3.5
// http://es5.github.com/#x15.2.3.5
if (!Object.create) {
    Object.create = function create(prototype, properties) {
        var object;
        if (prototype === null) {
            object = { "__proto__": null };
        } else {
            if (typeof prototype != "object") {
                throw new TypeError("typeof prototype["+(typeof prototype)+"] != 'object'");
            }
            var Type = function () {};
            Type.prototype = prototype;
            object = new Type();
            // IE has no built-in implementation of `Object.getPrototypeOf`
            // neither `__proto__`, but this manually setting `__proto__` will
            // guarantee that `Object.getPrototypeOf` will work as expected with
            // objects created using `Object.create`
            object.__proto__ = prototype;
        }
        if (properties !== void 0) {
            Object.defineProperties(object, properties);
        }
        return object;
    };
}

// ES5 15.2.3.6
// http://es5.github.com/#x15.2.3.6

// Patch for WebKit and IE8 standard mode
// Designed by hax <hax.github.com>
// related issue: https://github.com/kriskowal/es5-shim/issues#issue/5
// IE8 Reference:
//     http://msdn.microsoft.com/en-us/library/dd282900.aspx
//     http://msdn.microsoft.com/en-us/library/dd229916.aspx
// WebKit Bugs:
//     https://bugs.webkit.org/show_bug.cgi?id=36423

function doesDefinePropertyWork(object) {
    try {
        Object.defineProperty(object, "sentinel", {});
        return "sentinel" in object;
    } catch (exception) {
        // returns falsy
    }
}

// check whether defineProperty works if it's given. Otherwise,
// shim partially.
if (Object.defineProperty) {
    var definePropertyWorksOnObject = doesDefinePropertyWork({});
    var definePropertyWorksOnDom = typeof document == "undefined" ||
        doesDefinePropertyWork(document.createElement("div"));
    if (!definePropertyWorksOnObject || !definePropertyWorksOnDom) {
        var definePropertyFallback = Object.defineProperty;
    }
}

if (!Object.defineProperty || definePropertyFallback) {
    var ERR_NON_OBJECT_DESCRIPTOR = "Property description must be an object: ";
    var ERR_NON_OBJECT_TARGET = "Object.defineProperty called on non-object: "
    var ERR_ACCESSORS_NOT_SUPPORTED = "getters & setters can not be defined " +
                                      "on this javascript engine";

    Object.defineProperty = function defineProperty(object, property, descriptor) {
        if ((typeof object != "object" && typeof object != "function") || object === null) {
            throw new TypeError(ERR_NON_OBJECT_TARGET + object);
        }
        if ((typeof descriptor != "object" && typeof descriptor != "function") || descriptor === null) {
            throw new TypeError(ERR_NON_OBJECT_DESCRIPTOR + descriptor);
        }
        // make a valiant attempt to use the real defineProperty
        // for I8's DOM elements.
        if (definePropertyFallback) {
            try {
                return definePropertyFallback.call(Object, object, property, descriptor);
            } catch (exception) {
                // try the shim if the real one doesn't work
            }
        }

        // If it's a data property.
        if (owns(descriptor, "value")) {
            // fail silently if "writable", "enumerable", or "configurable"
            // are requested but not supported
            /*
            // alternate approach:
            if ( // can't implement these features; allow false but not true
                !(owns(descriptor, "writable") ? descriptor.writable : true) ||
                !(owns(descriptor, "enumerable") ? descriptor.enumerable : true) ||
                !(owns(descriptor, "configurable") ? descriptor.configurable : true)
            )
                throw new RangeError(
                    "This implementation of Object.defineProperty does not " +
                    "support configurable, enumerable, or writable."
                );
            */

            if (supportsAccessors && (lookupGetter(object, property) ||
                                      lookupSetter(object, property)))
            {
                // As accessors are supported only on engines implementing
                // `__proto__` we can safely override `__proto__` while defining
                // a property to make sure that we don't hit an inherited
                // accessor.
                var prototype = object.__proto__;
                object.__proto__ = prototypeOfObject;
                // Deleting a property anyway since getter / setter may be
                // defined on object itself.
                delete object[property];
                object[property] = descriptor.value;
                // Setting original `__proto__` back now.
                object.__proto__ = prototype;
            } else {
                object[property] = descriptor.value;
            }
        } else {
            if (!supportsAccessors) {
                throw new TypeError(ERR_ACCESSORS_NOT_SUPPORTED);
            }
            // If we got that far then getters and setters can be defined !!
            if (owns(descriptor, "get")) {
                defineGetter(object, property, descriptor.get);
            }
            if (owns(descriptor, "set")) {
                defineSetter(object, property, descriptor.set);
            }
        }
        return object;
    };
}

// ES5 15.2.3.7
// http://es5.github.com/#x15.2.3.7
if (!Object.defineProperties) {
    Object.defineProperties = function defineProperties(object, properties) {
        for (var property in properties) {
            if (owns(properties, property) && property != "__proto__") {
                Object.defineProperty(object, property, properties[property]);
            }
        }
        return object;
    };
}

// ES5 15.2.3.8
// http://es5.github.com/#x15.2.3.8
if (!Object.seal) {
    Object.seal = function seal(object) {
        // this is misleading and breaks feature-detection, but
        // allows "securable" code to "gracefully" degrade to working
        // but insecure code.
        return object;
    };
}

// ES5 15.2.3.9
// http://es5.github.com/#x15.2.3.9
if (!Object.freeze) {
    Object.freeze = function freeze(object) {
        // this is misleading and breaks feature-detection, but
        // allows "securable" code to "gracefully" degrade to working
        // but insecure code.
        return object;
    };
}

// detect a Rhino bug and patch it
try {
    Object.freeze(function () {});
} catch (exception) {
    Object.freeze = (function freeze(freezeObject) {
        return function freeze(object) {
            if (typeof object == "function") {
                return object;
            } else {
                return freezeObject(object);
            }
        };
    })(Object.freeze);
}

// ES5 15.2.3.10
// http://es5.github.com/#x15.2.3.10
if (!Object.preventExtensions) {
    Object.preventExtensions = function preventExtensions(object) {
        // this is misleading and breaks feature-detection, but
        // allows "securable" code to "gracefully" degrade to working
        // but insecure code.
        return object;
    };
}

// ES5 15.2.3.11
// http://es5.github.com/#x15.2.3.11
if (!Object.isSealed) {
    Object.isSealed = function isSealed(object) {
        return false;
    };
}

// ES5 15.2.3.12
// http://es5.github.com/#x15.2.3.12
if (!Object.isFrozen) {
    Object.isFrozen = function isFrozen(object) {
        return false;
    };
}

// ES5 15.2.3.13
// http://es5.github.com/#x15.2.3.13
if (!Object.isExtensible) {
    Object.isExtensible = function isExtensible(object) {
        // 1. If Type(O) is not Object throw a TypeError exception.
        if (Object(object) !== object) {
            throw new TypeError(); // TODO message
        }
        // 2. Return the Boolean value of the [[Extensible]] internal property of O.
        var name = '';
        while (owns(object, name)) {
            name += '?';
        }
        object[name] = true;
        var returnValue = owns(object, name);
        delete object[name];
        return returnValue;
    };
}

// ES5 15.2.3.14
// http://es5.github.com/#x15.2.3.14
if (!Object.keys) {
    // http://whattheheadsaid.com/2010/10/a-safer-object-keys-compatibility-implementation
    var hasDontEnumBug = true,
        dontEnums = [
            "toString",
            "toLocaleString",
            "valueOf",
            "hasOwnProperty",
            "isPrototypeOf",
            "propertyIsEnumerable",
            "constructor"
        ],
        dontEnumsLength = dontEnums.length;

    for (var key in {"toString": null}) {
        hasDontEnumBug = false;
    }

    Object.keys = function keys(object) {

        if ((typeof object != "object" && typeof object != "function") || object === null) {
            throw new TypeError("Object.keys called on a non-object");
        }

        var keys = [];
        for (var name in object) {
            if (owns(object, name)) {
                keys.push(name);
            }
        }

        if (hasDontEnumBug) {
            for (var i = 0, ii = dontEnumsLength; i < ii; i++) {
                var dontEnum = dontEnums[i];
                if (owns(object, dontEnum)) {
                    keys.push(dontEnum);
                }
            }
        }
        return keys;
    };

}

//
// Date
// ====
//

// ES5 15.9.5.43
// http://es5.github.com/#x15.9.5.43
// This function returns a String value represent the instance in time
// represented by this Date object. The format of the String is the Date Time
// string format defined in 15.9.1.15. All fields are present in the String.
// The time zone is always UTC, denoted by the suffix Z. If the time value of
// this object is not a finite Number a RangeError exception is thrown.
if (!Date.prototype.toISOString || 
    (new Date(-1).toISOString() !== '1969-12-31T23:59:59.999Z') ||
    (new Date(-62198755200000).toISOString().indexOf('-000001') === -1)) {
    Date.prototype.toISOString = function toISOString() {
        var result, length, value, year, month;
        if (!isFinite(this)) {
            throw new RangeError("Date.prototype.toISOString called on non-finite value.");
        }

        year = this.getUTCFullYear();

        month = this.getUTCMonth();
        // see https://github.com/kriskowal/es5-shim/issues/111
        year += Math.floor(month / 12);
        month = (month % 12 + 12) % 12;

        // the date time string format is specified in 15.9.1.15.
        result = [month + 1, this.getUTCDate(),
            this.getUTCHours(), this.getUTCMinutes(), this.getUTCSeconds()];
        year = (year < 0 ? '-' : (year > 9999 ? '+' : '')) + ('00000' + Math.abs(year)).slice(0 <= year && year <= 9999 ? -4 : -6);

        length = result.length;
        while (length--) {
            value = result[length];
            // pad months, days, hours, minutes, and seconds to have two digits.
            if (value < 10) {
                result[length] = "0" + value;
            }
        }
        // pad milliseconds to have three digits.
        return year + "-" + result.slice(0, 2).join("-") + "T" + result.slice(2).join(":") + "." +
            ("000" + this.getUTCMilliseconds()).slice(-3) + "Z";
    }
}

// ES5 15.9.4.4
// http://es5.github.com/#x15.9.4.4
if (!Date.now) {
    Date.now = function now() {
        return new Date().getTime();
    };
}


// ES5 15.9.5.44
// http://es5.github.com/#x15.9.5.44
// This function provides a String representation of a Date object for use by
// JSON.stringify (15.12.3).
function isPrimitive(input) {
    var t = typeof input;
    return input === null || t === "undefined" || t === "boolean" || t === "number" || t === "string";
}

function ToPrimitive(input) {
    var val, valueOf, toString;
    if (isPrimitive(input)) {
        return input;
    }
    valueOf = input.valueOf;
    if (typeof valueOf === "function") {
        val = valueOf.call(input);
        if (isPrimitive(val)) {
            return val;
        }
    }
    toString = input.toString;
    if (typeof toString === "function") {
        val = toString.call(input);
        if (isPrimitive(val)) {
            return val;
        }
    }
    throw new TypeError();
}

var dateToJSONIsSupported = false;
try {
    dateToJSONIsSupported = Date.prototype.toJSON && new Date(NaN).toJSON() === null;
} catch (e) {}
if (!dateToJSONIsSupported) {
    Date.prototype.toJSON = function toJSON(key) {
        // When the toJSON method is called with argument key, the following
        // steps are taken:

        // 1.  Let O be the result of calling ToObject, giving it the this
        // value as its argument.
        // 2. Let tv be ToPrimitive(O, hint Number).
        var o = Object(this),
            tv = ToPrimitive(o),
            toISO;
        // 3. If tv is a Number and is not finite, return null.
        if (typeof tv === 'number' && !isFinite(tv)) {
            return null;
        }
        // 4. Let toISO be the result of calling the [[Get]] internal method of
        // O with argument "toISOString".
        toISO = o.toISOString;
        // 5. If IsCallable(toISO) is false, throw a TypeError exception.
        if (typeof toISO != "function") {
            throw new TypeError('toISOString property is not callable');
        }
        // 6. Return the result of calling the [[Call]] internal method of
        //  toISO with O as the this value and an empty argument list.
        return toISO.call(o);

        // NOTE 1 The argument is ignored.

        // NOTE 2 The toJSON function is intentionally generic; it does not
        // require that its this value be a Date object. Therefore, it can be
        // transferred to other kinds of objects for use as a method. However,
        // it does require that any such object have a toISOString method. An
        // object is free to use the argument key to filter its
        // stringification.
    };
}

// ES5 15.9.4.2
// http://es5.github.com/#x15.9.4.2
// based on work shared by Daniel Friesen (dantman)
// http://gist.github.com/303249
if (!Date.parse || "Date.parse is buggy") {
    // XXX global assignment won't work in embeddings that use
    // an alternate object for the context.
    Date = (function(NativeDate) {

        // Date.length === 7
        var Date = function Date(Y, M, D, h, m, s, ms) {
            var length = arguments.length;
            if (this instanceof NativeDate) {
                var date = length == 1 && String(Y) === Y ? // isString(Y)
                    // We explicitly pass it through parse:
                    new NativeDate(Date.parse(Y)) :
                    // We have to manually make calls depending on argument
                    // length here
                    length >= 7 ? new NativeDate(Y, M, D, h, m, s, ms) :
                    length >= 6 ? new NativeDate(Y, M, D, h, m, s) :
                    length >= 5 ? new NativeDate(Y, M, D, h, m) :
                    length >= 4 ? new NativeDate(Y, M, D, h) :
                    length >= 3 ? new NativeDate(Y, M, D) :
                    length >= 2 ? new NativeDate(Y, M) :
                    length >= 1 ? new NativeDate(Y) :
                                  new NativeDate();
                // Prevent mixups with unfixed Date object
                date.constructor = Date;
                return date;
            }
            return NativeDate.apply(this, arguments);
        };

        // 15.9.1.15 Date Time String Format.
        var isoDateExpression = new RegExp("^" +
            "(\\d{4}|[\+\-]\\d{6})" + // four-digit year capture or sign + 6-digit extended year
            "(?:-(\\d{2})" + // optional month capture
            "(?:-(\\d{2})" + // optional day capture
            "(?:" + // capture hours:minutes:seconds.milliseconds
                "T(\\d{2})" + // hours capture
                ":(\\d{2})" + // minutes capture
                "(?:" + // optional :seconds.milliseconds
                    ":(\\d{2})" + // seconds capture
                    "(?:\\.(\\d{3}))?" + // milliseconds capture
                ")?" +
            "(" + // capture UTC offset component
                "Z|" + // UTC capture
                "(?:" + // offset specifier +/-hours:minutes
                    "([-+])" + // sign capture
                    "(\\d{2})" + // hours offset capture
                    ":(\\d{2})" + // minutes offset capture
                ")" +
            ")?)?)?)?" +
        "$");

        var monthes = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];

        function dayFromMonth(year, month) {
            var t = month > 1 ? 1 : 0;
            return monthes[month] + Math.floor((year - 1969 + t) / 4) - Math.floor((year - 1901 + t) / 100) + Math.floor((year - 1601 + t) / 400) + 365 * (year - 1970);
        }

        // Copy any custom methods a 3rd party library may have added
        for (var key in NativeDate) {
            Date[key] = NativeDate[key];
        }

        // Copy "native" methods explicitly; they may be non-enumerable
        Date.now = NativeDate.now;
        Date.UTC = NativeDate.UTC;
        Date.prototype = NativeDate.prototype;
        Date.prototype.constructor = Date;

        // Upgrade Date.parse to handle simplified ISO 8601 strings
        Date.parse = function parse(string) {
            var match = isoDateExpression.exec(string);
            if (match) {
                // parse months, days, hours, minutes, seconds, and milliseconds
                // provide default values if necessary
                // parse the UTC offset component
                var year = Number(match[1]),
                    month = Number(match[2] || 1) - 1,
                    day = Number(match[3] || 1) - 1,
                    hour = Number(match[4] || 0),
                    minute = Number(match[5] || 0),
                    second = Number(match[6] || 0),
                    millisecond = Number(match[7] || 0),
                    // When time zone is missed, local offset should be used (ES 5.1 bug)
                    // see https://bugs.ecmascript.org/show_bug.cgi?id=112
                    offset = !match[4] || match[8] ? 0 : Number(new Date(1970, 0)),
                    signOffset = match[9] === "-" ? 1 : -1,
                    hourOffset = Number(match[10] || 0),
                    minuteOffset = Number(match[11] || 0),
                    result;
                if (hour < (minute > 0 || second > 0 || millisecond > 0 ? 24 : 25) && 
                    minute < 60 && second < 60 && millisecond < 1000 && 
                    month > -1 && month < 12 && hourOffset < 24 && minuteOffset < 60 && // detect invalid offsets
                    day > -1 && day < dayFromMonth(year, month + 1) - dayFromMonth(year, month)) {
                    result = ((dayFromMonth(year, month) + day) * 24 + hour + hourOffset * signOffset) * 60;
                    result = ((result + minute + minuteOffset * signOffset) * 60 + second) * 1000 + millisecond + offset;
                    if (-8.64e15 <= result && result <= 8.64e15) {
                        return result;
                    }
                }
                return NaN;
            }
            return NativeDate.parse.apply(this, arguments);
        };

        return Date;
    })(Date);
}

//
// String
// ======
//

// ES5 15.5.4.20
// http://es5.github.com/#x15.5.4.20
var ws = "\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003" +
    "\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028" +
    "\u2029\uFEFF";
if (!String.prototype.trim || ws.trim()) {
    // http://blog.stevenlevithan.com/archives/faster-trim-javascript
    // http://perfectionkills.com/whitespace-deviations/
    ws = "[" + ws + "]";
    var trimBeginRegexp = new RegExp("^" + ws + ws + "*"),
        trimEndRegexp = new RegExp(ws + ws + "*$");
    String.prototype.trim = function trim() {
        if (this === undefined || this === null) {
            throw new TypeError("can't convert "+this+" to object");
        }
        return String(this).replace(trimBeginRegexp, "").replace(trimEndRegexp, "");
    };
}

//
// Util
// ======
//

// ES5 9.4
// http://es5.github.com/#x9.4
// http://jsperf.com/to-integer
var toInteger = function (n) {
    n = +n;
    if (n !== n) { // isNaN
        n = 0;
    } else if (n !== 0 && n !== (1/0) && n !== -(1/0)) {
        n = (n > 0 || -1) * Math.floor(Math.abs(n));
    }
    return n;
};

var prepareString = "a"[0] != "a";
    // ES5 9.9
    // http://es5.github.com/#x9.9
var toObject = function (o) {
    if (o == null) { // this matches both null and undefined
        throw new TypeError("can't convert "+o+" to object");
    }
    // If the implementation doesn't support by-index access of
    // string characters (ex. IE < 9), split the string
    if (prepareString && typeof o == "string" && o) {
        return o.split("");
    }
    return Object(o);
};
});

});

Numbas.queueScript('sarissa_ieemu_xpath',['sarissa'],function() {
/**
 * ====================================================================
 * About
 * ====================================================================
 * Sarissa cross browser XML library - IE XPath Emulation 
 * @version 0.9.9.5
 * @author: Copyright 2004-2007 Emmanouil Batsis, mailto: mbatsis at users full stop sourceforge full stop net
 *
 * This script emulates Internet Explorer's selectNodes and selectSingleNode
 * for Mozilla. Associating namespace prefixes with URIs for your XPath queries
 * is easy with IE's setProperty. 
 * USers may also map a namespace prefix to a default (unprefixed) namespace in the
 * source document with Sarissa.setXpathNamespaces
 *
 * ====================================================================
 * Licence
 * ====================================================================
 * Sarissa is free software distributed under the GNU GPL version 2 (see <a href="gpl.txt">gpl.txt</a>) or higher, 
 * GNU LGPL version 2.1 (see <a href="lgpl.txt">lgpl.txt</a>) or higher and Apache Software License 2.0 or higher 
 * (see <a href="asl.txt">asl.txt</a>). This means you can choose one of the three and use that if you like. If 
 * you make modifications under the ASL, i would appreciate it if you submitted those.
 * In case your copy of Sarissa does not include the license texts, you may find
 * them online in various formats at <a href="http://www.gnu.org">http://www.gnu.org</a> and 
 * <a href="http://www.apache.org">http://www.apache.org</a>.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY 
 * KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE 
 * WARRANTIES OF MERCHANTABILITY,FITNESS FOR A PARTICULAR PURPOSE 
 * AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR 
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR 
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
if(Sarissa._SARISSA_HAS_DOM_FEATURE && document.implementation.hasFeature("XPath", "3.0")){
    /**
     * <p>SarissaNodeList behaves as a NodeList but is only used as a result to <code>selectNodes</code>,
     * so it also has some properties IEs proprietery object features.</p>
     * @private
     * @constructor
     * @argument i the (initial) list size
     */
    SarissaNodeList = function (i){
        this.length = i;
    };
    /** 
     * <p>Set an Array as the prototype object</p> 
     * @private
     */
    SarissaNodeList.prototype = [];
    /** 
     * <p>Inherit the Array constructor </p> 
     * @private
     */
    SarissaNodeList.prototype.constructor = Array;
    /**
     * <p>Returns the node at the specified index or null if the given index
     * is greater than the list size or less than zero </p>
     * <p><b>Note</b> that in ECMAScript you can also use the square-bracket
     * array notation instead of calling <code>item</code>
     * @argument i the index of the member to return
     * @returns the member corresponding to the given index
     * @private
     */
    SarissaNodeList.prototype.item = function(i) {
        return (i < 0 || i >= this.length)?null:this[i];
    };
    /**
     * <p>Emulate IE's expr property
     * (Here the SarissaNodeList object is given as the result of selectNodes).</p>
     * @returns the XPath expression passed to selectNodes that resulted in
     *          this SarissaNodeList
     * @private
     */
    SarissaNodeList.prototype.expr = "";
    /** dummy, used to accept IE's stuff without throwing errors */
    if(window.XMLDocument && (!XMLDocument.prototype.setProperty)){
        XMLDocument.prototype.setProperty  = function(x,y){};
    }
    /**
    * <p>Programmatically control namespace URI/prefix mappings for XPath
    * queries.</p>
    * <p>This method comes especially handy when used to apply XPath queries
    * on XML documents with a default namespace, as there is no other way
    * of mapping that to a prefix.</p>
    * <p>Using no namespace prefix in DOM Level 3 XPath queries, implies you
    * are looking for elements in the null namespace. If you need to look
    * for nodes in the default namespace, you need to map a prefix to it
    * first like:</p>
    * <pre>Sarissa.setXpathNamespaces(oDoc, "xmlns:myprefix'http://mynsURI'");</pre>
    * <p><b>Note 1 </b>: Use this method only if the source document features
    * a default namespace (without a prefix), otherwise just use IE's setProperty
    * (moz will rezolve non-default namespaces by itself). You will need to map that
    * namespace to a prefix for queries to work.</p>
    * <p><b>Note 2 </b>: This method calls IE's setProperty method to set the
    * appropriate namespace-prefix mappings, so you dont have to do that.</p>
    * @param oDoc The target XMLDocument to set the namespace mappings for.
    * @param sNsSet A whilespace-seperated list of namespace declarations as
    *            those would appear in an XML document. E.g.:
    *            <code>&quot;xmlns:xhtml=&apos;http://www.w3.org/1999/xhtml&apos;
    * xmlns:&apos;http://www.w3.org/1999/XSL/Transform&apos;&quot;</code>
    * @throws An error if the format of the given namespace declarations is bad.
    */
    Sarissa.setXpathNamespaces = function(oDoc, sNsSet) {
        //oDoc._sarissa_setXpathNamespaces(sNsSet);
        oDoc._sarissa_useCustomResolver = true;
        var namespaces = sNsSet.indexOf(" ")>-1?sNsSet.split(" "):[sNsSet];
        oDoc._sarissa_xpathNamespaces = [];
        for(var i=0;i < namespaces.length;i++){
            var ns = namespaces[i];
            var colonPos = ns.indexOf(":");
            var assignPos = ns.indexOf("=");
            if(colonPos > 0 && assignPos > colonPos+1){
                var prefix = ns.substring(colonPos+1, assignPos);
                var uri = ns.substring(assignPos+2, ns.length-1);
                oDoc._sarissa_xpathNamespaces[prefix] = uri;
            }else{
                throw "Bad format on namespace declaration(s) given";
            }
        }
    };
    /**
    * @private Flag to control whether a custom namespace resolver should
    *          be used, set to true by Sarissa.setXpathNamespaces
    */
    XMLDocument.prototype._sarissa_useCustomResolver = false;
    /** @private */
    XMLDocument.prototype._sarissa_xpathNamespaces = [];
    /**
    * <p>Extends the XMLDocument to emulate IE's selectNodes.</p>
    * @argument sExpr the XPath expression to use
    * @argument contextNode this is for internal use only by the same
    *           method when called on Elements
    * @returns the result of the XPath search as a SarissaNodeList
    * @throws An error if no namespace URI is found for the given prefix.
    */
    XMLDocument.prototype.selectNodes = function(sExpr, contextNode, returnSingle){
        var nsDoc = this;
        var nsresolver;
        if(this._sarissa_useCustomResolver){
            nsresolver = function(prefix){
                var s = nsDoc._sarissa_xpathNamespaces[prefix];
                if(s){
                    return s;
                }
                else {
                    throw "No namespace URI found for prefix: '" + prefix+"'";
                }
            };
        }
        else{
            nsresolver = this.createNSResolver(this.documentElement);
        }
        var result = null;
        if(!returnSingle){
            var oResult = this.evaluate(sExpr,
                (contextNode?contextNode:this),
                nsresolver,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            var nodeList = new SarissaNodeList(oResult.snapshotLength);
            nodeList.expr = sExpr;
            for(var i=0;i<nodeList.length;i++){
                nodeList[i] = oResult.snapshotItem(i);
            }
            result = nodeList;
        }
        else {
            result = this.evaluate(sExpr,
                (contextNode?contextNode:this),
                nsresolver,
                XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        }
        return result;      
    };
    /**
    * <p>Extends the Element to emulate IE's selectNodes</p>
    * @argument sExpr the XPath expression to use
    * @returns the result of the XPath search as an (Sarissa)NodeList
    * @throws An
    *             error if invoked on an HTML Element as this is only be
    *             available to XML Elements.
    */
    Element.prototype.selectNodes = function(sExpr){
        var doc = this.ownerDocument;
        if(doc.selectNodes){
            return doc.selectNodes(sExpr, this);
        }
        else{
            throw "Method selectNodes is only supported by XML Elements";
        }
    };
    /**
    * <p>Extends the XMLDocument to emulate IE's selectSingleNode.</p>
    * @argument sExpr the XPath expression to use
    * @argument contextNode this is for internal use only by the same
    *           method when called on Elements
    * @returns the result of the XPath search as an (Sarissa)NodeList
    */
    XMLDocument.prototype.selectSingleNode = function(sExpr, contextNode){
        var ctx = contextNode?contextNode:null;
        return this.selectNodes(sExpr, ctx, true);
    };
    /**
    * <p>Extends the Element to emulate IE's selectSingleNode.</p>
    * @argument sExpr the XPath expression to use
    * @returns the result of the XPath search as an (Sarissa)NodeList
    * @throws An error if invoked on an HTML Element as this is only be
    *             available to XML Elements.
    */
    Element.prototype.selectSingleNode = function(sExpr){
        var doc = this.ownerDocument;
        if(doc.selectSingleNode){
            return doc.selectSingleNode(sExpr, this);
        }
        else{
            throw "Method selectNodes is only supported by XML Elements";
        }
    };
    Sarissa.IS_ENABLED_SELECT_NODES = true;
}
});
