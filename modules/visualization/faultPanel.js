import {activateSimulation} from './tokenSimulator.js';

export function faultDetails(){
    console.log("fault details clicked");
    $('#detail-panel').fadeToggle();

    activateSimulation();
    $('#error-simulation-button').click(activateSimulation);
}