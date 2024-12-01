let startSubscription = function(){
    faultBus.subscribe(processFault);
}

let processFault = function(type, process, elements, fault){
    console.log("processFault function is logging: ", process);
    console.log(process.getId);


    var overlays = window.bpmnModeler.get('overlays');

    // Get the necessary configs depending on the fault
    let markerConfigs = getMarker(fault);

    // Attach an overlay to a node
    overlays.add(process.getId, 'note', markerConfigs);

    // Add marker
    let canvas = window.bpmnModeler.get('canvas');
    canvas.addMarker(process.getId, 'needs-discussion');
}