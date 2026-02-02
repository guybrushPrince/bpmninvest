import { StandardFaultType as FaultType } from "./stfaulttypes.mjs";
import $ from "jquery";

const StandardAnalysisCategories = {
    SAFENESS: 'safeness',
    OPTION_TO_COMPLETE: 'optionToComplete',
    PROPER_COMPLETION: 'properCompletion',
    NO_DEAD_ACTIVITIES: 'noDeadActivities',
    BEST_PRACTICES: 'bestPractices'
};

let extensions = {};
let implications = [];

const AnalysisPanel = function (faultBus, categories = null) {

    function AnalysisPanelFactory(faultBus, categories = null) {
        faultBus.subscribe(this);

        this.extend = function (type, wV = () => {}, cV = () => {}) {
            extensions[type] = wV;
            implications.push(cV);
        };

        let setAnalysisPanel = function (violated, fulfilled = []) {
            let safeness = $('#Safeness, #Safeness-icon');
            let optionToComplete = $('#OptionToComplete, #OptionToComplete-icon');
            let properCompletion = $('#ProperCompletion, #ProperCompletion-icon');
            let noDeadActivities = $('#NoDeadActivities, #NoDeadActivities-icon');
            let bestPractices = $('#BestPractices, #BestPractices-icon');

            if (violated.includes(StandardAnalysisCategories.SAFENESS)) {
                safeness.removeClass('fulfilled icon-check');
                safeness.addClass('violated icon-xmark');
            }
            if (violated.includes(StandardAnalysisCategories.OPTION_TO_COMPLETE)) {
                optionToComplete.removeClass('fulfilled icon-check');
                optionToComplete.addClass('violated icon-xmark');
            }
            if (violated.includes(StandardAnalysisCategories.PROPER_COMPLETION)) {
                properCompletion.removeClass('fulfilled icon-check');
                properCompletion.addClass('violated icon-xmark');
            }
            if (violated.includes(StandardAnalysisCategories.NO_DEAD_ACTIVITIES)) {
                noDeadActivities.removeClass('fulfilled icon-check');
                noDeadActivities.addClass('violated icon-xmark');
            }
            if (violated.includes(StandardAnalysisCategories.BEST_PRACTICES)) {
                bestPractices.removeClass('fulfilled icon-check');
                bestPractices.addClass('violated icon-xmark');
            }

            if (fulfilled.includes(StandardAnalysisCategories.SAFENESS)) {
                safeness.addClass('fulfilled icon-check');
                safeness.removeClass('violated icon-xmark');
            }
            if (fulfilled.includes(StandardAnalysisCategories.OPTION_TO_COMPLETE)) {
                optionToComplete.addClass('fulfilled icon-check');
                optionToComplete.removeClass('violated icon-xmark');
            }
            if (fulfilled.includes(StandardAnalysisCategories.PROPER_COMPLETION)) {
                properCompletion.addClass('fulfilled icon-check');
                properCompletion.removeClass('violated icon-xmark');
            }
            if (fulfilled.includes(StandardAnalysisCategories.NO_DEAD_ACTIVITIES)) {
                noDeadActivities.addClass('fulfilled icon-check');
                noDeadActivities.removeClass('violated icon-xmark');
            }
            if (fulfilled.includes(StandardAnalysisCategories.BEST_PRACTICES)) {
                bestPractices.addClass('fulfilled icon-check');
                bestPractices.removeClass('violated icon-xmark');
            }
            implications.forEach(f => f());
        };

        let informAnalysisPanel = function(type) {
            switch (type) {
                case FaultType.NO_START:
                case FaultType.NO_END: {
                    setAnalysisPanel([
                        StandardAnalysisCategories.OPTION_TO_COMPLETE,
                        StandardAnalysisCategories.PROPER_COMPLETION,
                        StandardAnalysisCategories.NO_DEAD_ACTIVITIES,
                        StandardAnalysisCategories.BEST_PRACTICES
                    ]);
                } break;
                case FaultType.IMPLICIT_START:
                case FaultType.IMPLICIT_END:
                case FaultType.GATEWAY_WITHOUT_MULTIPLE_FLOWS: {
                    setAnalysisPanel([
                        StandardAnalysisCategories.BEST_PRACTICES
                    ]);
                } break;
                case FaultType.LOOP_EXIT_NOT_XOR: {
                    setAnalysisPanel([
                        StandardAnalysisCategories.SAFENESS,
                        StandardAnalysisCategories.PROPER_COMPLETION,
                        StandardAnalysisCategories.BEST_PRACTICES
                    ]);
                } break;
                case FaultType.LOOP_ENTRY_IS_AND: {
                    setAnalysisPanel([
                        StandardAnalysisCategories.OPTION_TO_COMPLETE,
                        StandardAnalysisCategories.PROPER_COMPLETION,
                        StandardAnalysisCategories.NO_DEAD_ACTIVITIES,
                        StandardAnalysisCategories.BEST_PRACTICES
                    ]);
                } break;
                case FaultType.LOOP_BACK_JOIN_IS_AND: {
                    setAnalysisPanel([
                        StandardAnalysisCategories.OPTION_TO_COMPLETE,
                        StandardAnalysisCategories.PROPER_COMPLETION,
                        StandardAnalysisCategories.NO_DEAD_ACTIVITIES
                    ]);
                } break;
                case FaultType.POTENTIAL_DEADLOCK: {
                    setAnalysisPanel([
                        StandardAnalysisCategories.OPTION_TO_COMPLETE,
                        StandardAnalysisCategories.PROPER_COMPLETION,
                        StandardAnalysisCategories.NO_DEAD_ACTIVITIES
                    ]);
                } break;
                case FaultType.POTENTIAL_LACK_OF_SYNCHRONIZATION:
                case FaultType.POTENTIAL_ENDLESS_LOOP: {
                    setAnalysisPanel([
                        StandardAnalysisCategories.SAFENESS,
                        StandardAnalysisCategories.PROPER_COMPLETION
                    ]);
                } break;
                case FaultType.LIVE_LOCK: {
                    setAnalysisPanel([
                        StandardAnalysisCategories.PROPER_COMPLETION,
                        StandardAnalysisCategories.OPTION_TO_COMPLETE,
                        StandardAnalysisCategories.BEST_PRACTICES
                    ]);
                } break;
                case FaultType.DEAD_LOOP: {
                    setAnalysisPanel([
                        StandardAnalysisCategories.NO_DEAD_ACTIVITIES,
                        StandardAnalysisCategories.BEST_PRACTICES
                    ]);
                } break;
                default: {
                    if (type in extensions) {
                        try {
                            extensions[type]();
                        } catch (exception) {
                            console.error(exception);
                        }
                    }
                }
            }
        };

        if (categories === null) categories = [
            StandardAnalysisCategories.SAFENESS,
            StandardAnalysisCategories.OPTION_TO_COMPLETE,
            StandardAnalysisCategories.PROPER_COMPLETION,
            StandardAnalysisCategories.NO_DEAD_ACTIVITIES,
            StandardAnalysisCategories.BEST_PRACTICES
        ]
        this.categories = categories;
        setAnalysisPanel([], this.categories);

        this.notify = function (type, process, elements, fault) {
            informAnalysisPanel(fault);
        };
    }

    return (function (faultBus, categories = null) {
        return new AnalysisPanelFactory(faultBus, categories);
    })(faultBus, categories);
}

export { AnalysisPanel, StandardAnalysisCategories };