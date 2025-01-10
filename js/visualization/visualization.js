let startSubscription = function(){
    faultBus.subscribe(processFault);
}

let processFault = function(messageType, process, elements, faultType){
    console.log("processFault function is logging: ", elements);

    var overlays = window.bpmnModeler.get('overlays');

    // Get the necessary configs depending on the fault
    let markerConfigs = getMarker(faultType, messageType);

    // Attach an overlay to a node
    let elementId = getJQueryId(process, elements, faultType);
    overlays.add(elementId, messageType, markerConfigs);

    // Add marker
    let canvas = window.bpmnModeler.get('canvas');
    canvas.addMarker(elementId, messageType);
}