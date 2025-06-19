let explanation = function (panel) {
    panel.append('<h1>Process Model has no End Event</h1>');

    panel.append('<h2>Explanation</h2>');
    panel.append('<p>Following the BPMN 2.0.2 specification, a BPMN process model requires at least one ending ' +
        'point. Such an ending point can be either an explicit <em>End Event</em> or an implicit end ' +
        '(a node without outgoing sequence flows). Such end points define where your process model may end ' +
        'after instantiation.' + '</p>');

    panel.append('<h2>Flaw in your process model</h2>');
    panel.append('<p>Your process model does not contain any explicit or implicit ending point. ' +
        'As a consequence, any execution finally leads to an endless loop repeating the same tasks again and again. ' +
        'For this reason, the process model can never successfully terminate.</p>');

    panel.append('<h2>Repair suggestions</h2>');
    panel.append('<p>Please re-investigate your process model to identify places where your process model shall ' +
        'terminate. On such places, you either insert an <em>End Event</em> or another node without outgoing ' +
        'sequence flows.' +
        '</p>');

    panel.append('<h2>References:</h2>');
    panel.append('<blockquote>' +
        'Object Management Group (OMG)<br>' +
        '<a href="https://www.omg.org/spec/BPMN/2.0.2/PDF" target="_blank">Business Process Model and Notation (BPMN).</a><br>' +
        'Version 2.0.2 (December 2013)' +
        '</blockquote>');
    panel.append('<blockquote>' +
        'Marlon Dumas, Marcello La Rosa, Jan Mendling, Hajo A. Reijers<br>' +
        '<a href="https://doi.org/10.1007/978-3-662-56509-4" target="_blank">Fundamentals of Business Process Management.</a><br>' +
        'Second Edition. Springer 2018, ISBN 978-3-662-56508-7, pp. 181-187.' +
        '</blockquote>');
};

export { explanation };