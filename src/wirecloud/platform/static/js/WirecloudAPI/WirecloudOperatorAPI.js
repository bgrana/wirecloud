/*
 *     Copyright (c) 2012-2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 *     This file is part of Wirecloud Platform.
 *
 *     Wirecloud Platform is free software: you can redistribute it and/or
 *     modify it under the terms of the GNU Affero General Public License as
 *     published by the Free Software Foundation, either version 3 of the
 *     License, or (at your option) any later version.
 *
 *     Wirecloud is distributed in the hope that it will be useful, but WITHOUT
 *     ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 *     FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
 *     License for more details.
 *
 *     You should have received a copy of the GNU Affero General Public License
 *     along with Wirecloud Platform.  If not, see
 *     <http://www.gnu.org/licenses/>.
 *
 */

/*global MashupPlatform*/

(function () {

    "use strict";

    var platform, ioperator, endpoint_name, inputs, outputs;

    platform = window.parent;

    // Init resource entry (in this case an operator) so other API files can make
    // use of it
    ioperator = platform.Wirecloud.activeWorkspace.wiring.ioperators[MashupPlatform.priv.id];
    MashupPlatform.priv.resource = ioperator;

    // Operator Module
    Object.defineProperty(window.MashupPlatform, 'operator', {value: {}});
    Object.defineProperty(window.MashupPlatform.operator, 'id', {value: MashupPlatform.priv.id});
    Object.defineProperty(window.MashupPlatform.operator, 'log', {
        value: function log(msg, level) {
            ioperator.logManager.log(msg, level);
        }
    });

    // Inputs
    inputs = {};
    for (endpoint_name in ioperator.inputs) {
        inputs[endpoint_name] = new MashupPlatform.priv.InputEndpoint(ioperator.inputs[endpoint_name], true);
    }
    Object.defineProperty(window.MashupPlatform.operator, 'inputs', {value: inputs});

    // Outputs
    outputs = {};
    for (endpoint_name in ioperator.outputs) {
        outputs[endpoint_name] = new MashupPlatform.priv.OutputEndpoint(ioperator.outputs[endpoint_name], true);
    }
    Object.defineProperty(window.MashupPlatform.operator, 'outputs', {value: outputs});

})();
