import { faultDetails } from "./faultPanel.js";
import { getMarker, getJQueryId } from "./createMarker.js";

export function startSubscription(){
    faultBus.subscribe(processFault);
}

let processFault = function(messageType, process, elements, faultType){
    console.log("new fault found");

    var overlays = window.bpmnModeler.get('overlays');

    // Get the necessary configs depending on the fault
    let markerConfigs = getMarker(faultType, messageType);

    // Attach an overlay to a node
    let elementId = getJQueryId(process, elements, faultType);
    overlays.add(elementId, messageType, markerConfigs);
    console.log("overlay.add called");

    let canvas = window.bpmnModeler.get('canvas');
    //see if element already has a marker for the same fault
    //only add if not
    if (canvas.hasMarker(elementId, messageType) === false){
        // Add marker
        canvas.addMarker(elementId, messageType);
        console.log("marker added");
        
        // Add click event to marker
        let marker = document.querySelector(`[data-container-id="${elementId}"] .${faultType.toLowerCase()}`);
        console.log(marker);
        if (marker){
            marker.addEventListener('click', faultDetails);
        }
    }
}