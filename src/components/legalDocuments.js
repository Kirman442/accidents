export const LEGAL_CONTACT = { name: 'Kirill Lisochenko', email: 'k.lisochenko@web.de' };

const links = {
    github: { href: 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement', label: 'GitHub · Privacy Statement' },
    pages: { href: 'https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages', label: 'GitHub · GitHub Pages und Verbindungsdaten' },
    supabase: { href: 'https://supabase.com/privacy', label: 'Supabase · Privacy Policy' },
    supabaseDpa: { href: 'https://supabase.com/legal/customer-resources/data-processing-addendum', label: 'Supabase · Data Processing Addendum' },
    supabaseTransfers: { href: 'https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq', label: 'Supabase · Datenstandorte und Übermittlungen' },
    carto: { href: 'https://www.carto.com/legal/basemap-terms/', label: 'CARTO · Basemaps Terms, Abschnitt 10' },
    cartoDpa: { href: 'https://carto.com/legal/pdpa', label: 'CARTO · Personal Data Processing Agreement' },
    authority: { href: 'https://www.lda.bayern.de/', label: 'Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)' },
};

export const LEGAL_DOCUMENTS = {
    impressum: {
        label: 'Impressum',
        title: 'Impressum',
        contactTitle: 'Anbieter und Kontakt',
        intro: 'Accidents ist ein eigenständiges GIS- und Visualisierungsprojekt zur Darstellung öffentlich verfügbarer, geokodierter Verkehrsunfälle mit Personenschaden in Deutschland. Es ist kein amtliches Angebot.',
        sections: [
            {
                title: 'Verantwortlich für die Inhalte',
                paragraphs: ['Kirill Lisochenko ist Anbieter dieser Anwendung und verantwortlich für ihre eigenen Inhalte. Für Fragen zum Projekt nutzen Sie bitte die oben genannte E-Mail-Adresse.'],
            },
            {
                title: 'Daten und Kartenquellen',
                paragraphs: ['Die Unfalldaten stammen aus dem Unfallatlas der Statistischen Ämter des Bundes und der Länder. Unfälle mit ausschließlich Sachschaden sind nicht enthalten. Die Daten werden über Supabase bereitgestellt. Der Kartenhintergrund stammt von CARTO auf Grundlage von OpenStreetMap-Daten. Die Quellenangaben bleiben direkt am Kartenrand sichtbar.'],
                links: [
                    { href: 'https://unfallatlas.statistikportal.de/', label: 'Unfallatlas · Statistische Ämter des Bundes und der Länder' },
                    { href: 'https://carto.com/attribution/index.html', label: 'CARTO · Attribution' },
                    { href: 'https://www.openstreetmap.org/copyright', label: 'OpenStreetMap · Urheberrecht und Lizenz' },
                ],
            },
        ],
    },
    datenschutz: {
        label: 'Datenschutz',
        title: 'Datenschutzerklärung',
        contactTitle: 'Verantwortlicher und Kontakt',
        intro: 'Diese Datenschutzerklärung erläutert, welche personenbezogenen Daten beim Besuch von Accidents verarbeitet werden. Die Anwendung bietet keine Benutzerkonten, Werbeanzeigen oder eingebundenen Analysedienste zur Verfolgung Ihres Nutzungsverhaltens.',
        sections: [
            {
                title: 'Bereitstellung über GitHub Pages',
                paragraphs: [
                    'Die Website wird über GitHub Pages bereitgestellt. Beim Abruf werden technisch notwendige Verbindungsdaten verarbeitet, etwa IP-Adresse, Zeitpunkt, angeforderte Adresse und Browserinformationen. GitHub weist ausdrücklich darauf hin, dass IP-Adressen von Besuchern einer GitHub-Pages-Website zu Sicherheitszwecken protokolliert und gespeichert werden, auch ohne GitHub-Anmeldung.',
                    'Zweck ist die Auslieferung und Absicherung dieses öffentlich zugänglichen Informationsangebots. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO. Für die von GitHub in eigener Verantwortung verarbeiteten Nutzungs- und Sicherheitsdaten gelten dessen Datenschutzhinweise und Aufbewahrungsregeln; ein projektspezifischer fester Löschzeitraum wird hier nicht zugesagt.',
                ],
                links: [links.github, links.pages],
            },
            {
                title: 'Abruf der Unfalldaten über Supabase',
                paragraphs: [
                    'Ihr Browser lädt Koordinaten und Merkmale der öffentlichen Unfalldaten direkt über die Supabase-Daten-API. Supabase erhält dabei Ihre IP-Adresse, technische Angaben zur Verbindung und die angefragte API-Adresse. Die Daten werden nach Bundesländern in mehreren Anfragen abgerufen; die Filterung und Darstellung erfolgen anschließend im Browser.',
                    'Supabase wird für die Bereitstellung der Daten als Auftragsverarbeiter eingesetzt. Rechtsgrundlage für die technisch notwendigen Verbindungsdaten ist Art. 6 Abs. 1 Buchst. f DSGVO: das Interesse an einer funktionsfähigen, öffentlich zugänglichen Unfallkarte. Besucher müssen sich dafür nicht anmelden. Die Anwendung bietet keine Funktion zum Hochladen eigener personenbezogener Daten.',
                    'Bei Supabase können technische Anfrage- und Sicherheitsprotokolle entstehen. Deren Aufbewahrung richtet sich nach dem eingesetzten Dienst und Tarif. Die Region der Projektdatenbank allein bedeutet nicht, dass sämtliche Verbindungs-, Betriebs- und Supportdaten ausschließlich dort verarbeitet werden.',
                ],
                links: [links.supabase, links.supabaseDpa, links.supabaseTransfers],
            },
            {
                title: 'Kartenhintergrund von CARTO',
                paragraphs: [
                    'Beim Öffnen der Anwendung lädt Ihr Browser den Kartenhintergrund direkt von CARTO. Dazu gehören Kartenstil, Kartenkacheln sowie Kartenschriften und Symbole. Dabei werden Ihre IP-Adresse, technische Anfragedaten und die angeforderten Kartenausschnitte übermittelt. Eine Standortfreigabe des Geräts wird nicht angefordert.',
                    'Die Einbindung dient der räumlichen Einordnung der Unfalldaten. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO: das Interesse, die ausdrücklich aufgerufene Karte funktionsfähig darzustellen. Nach den veröffentlichten Basemap-Bedingungen kürzt CARTO IP-Adressen vor der Speicherung und bewahrt die gekürzten Anfrageprotokolle 30 Tage in den USA auf.',
                ],
                links: [links.carto, links.cartoDpa],
            },
            {
                title: 'Verarbeitung in Ihrem Browser',
                paragraphs: [
                    'Die aus Supabase abgerufenen Unfalldaten werden im Arbeitsspeicher Ihres Browsers für Filter, Punkte, Hexagone und Heatmap verarbeitet. Die dargestellten Unfallorte sind keine Standortmessungen Ihres Geräts.',
                    'Die Anwendung setzt keine eigenen Werbe- oder Tracking-Cookies und speichert Karten- und Filtereinstellungen nicht im Local Storage oder Session Storage. Diese Einstellungen bestehen nur im Arbeitsspeicher der geöffneten Seite. Der Browser kann ausgelieferte Dateien und Kartenkacheln in seinem üblichen HTTP-Cache speichern.',
                ],
            },
            {
                title: 'Empfänger und Übermittlungen außerhalb der EU',
                paragraphs: [
                    'GitHub, Supabase und CARTO sowie deren technische Dienstleister erhalten die jeweils beschriebenen Verbindungsdaten. Eine Verarbeitung außerhalb der EU bzw. des EWR ist möglich. Die verlinkten Datenschutzhinweise und Vereinbarungen erläutern Datenstandorte, Empfänger und Schutzmaßnahmen, insbesondere EU-Standardvertragsklauseln. Das EU-U.S. Data Privacy Framework gilt nur für entsprechend zertifizierte Empfänger und die davon erfassten Übermittlungen.',
                ],
                links: [links.github, links.supabaseDpa, links.supabaseTransfers, links.cartoDpa],
            },
            {
                title: 'Anfragen per E-Mail und externe Links',
                paragraphs: [
                    'Wenn Sie uns per E-Mail kontaktieren, werden Ihre E-Mail-Adresse und der Inhalt Ihrer Nachricht zur Bearbeitung der Anfrage verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO, bei der Erfüllung gesetzlicher Datenschutzpflichten Art. 6 Abs. 1 Buchst. c DSGVO. Nachrichten werden gelöscht, sobald die Bearbeitung abgeschlossen ist und keine gesetzlichen Aufbewahrungspflichten oder offenen Rechtsansprüche entgegenstehen.',
                    'Links zu Quellen und Dokumentationen öffnen fremde Websites erst, wenn Sie den Link auswählen. Dort gelten die Datenschutzhinweise des jeweiligen Anbieters. Verbindungen zu Supabase und zum CARTO-Kartendienst entstehen dagegen bereits beim Laden der Karte.',
                ],
            },
            {
                title: 'Ihre Rechte',
                paragraphs: [
                    'Unter den gesetzlichen Voraussetzungen haben Sie das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit. Wenn eine Verarbeitung auf Ihrer Einwilligung beruht, können Sie diese jederzeit mit Wirkung für die Zukunft widerrufen.',
                    'Widerspruchsrecht: Gegen eine Verarbeitung auf Grundlage von Art. 6 Abs. 1 Buchst. f DSGVO können Sie aus Gründen, die sich aus Ihrer besonderen Situation ergeben, Widerspruch einlegen (Art. 21 DSGVO). Nutzen Sie dafür die oben genannte E-Mail-Adresse.',
                    'Sie können sich bei einer Datenschutzaufsichtsbehörde beschweren, insbesondere an Ihrem Aufenthaltsort, Arbeitsplatz oder am Ort des vermuteten Verstoßes. Für einen privaten Betreiber in Bayern ist das BayLDA zuständig. Die Anwendung trifft keine automatisierten Entscheidungen mit rechtlicher oder ähnlich erheblicher Wirkung und erstellt keine Nutzerprofile. Die Angabe personenbezogener Daten ist weder gesetzlich noch vertraglich vorgeschrieben; ohne die zur Übertragung nötigen Verbindungsdaten können Website und Karte jedoch nicht ausgeliefert werden.',
                ],
                links: [links.authority],
            },
        ],
    },
};
