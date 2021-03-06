/*
 *     Copyright (c) 2012-2016 CoNWeT Lab., Universidad Politécnica de Madrid
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

/* globals LayoutManagerFactory, Wirecloud */

(function (utils) {

    "use strict";

    /*************************************************************************
     * Private methods
     *************************************************************************/

    var uninstallOrDeleteSuccessCallback = function uninstallOrDeleteSuccessCallback(resource, next, result) {
        var layoutManager, result, i, iwidget, resource_full_id, resource, index, operator;

        if (result.affectedVersions == null) {
            result.affectedVersions = [resource.version];
        }

        switch (resource.type) {
        case 'widget':
            layoutManager = LayoutManagerFactory.getInstance();

            layoutManager.logSubTask(utils.gettext('Unloading affected widgets'));
            result.affectedVersions.forEach(function (version) {
                var new_meta = Wirecloud.activeWorkspace.resources.remove(resource.group_id + '/' + version);
                if (new_meta != null) {
                    Wirecloud.activeWorkspace.getIWidgets().forEach(function (widget) {
                        var iwidget_meta = widget.internal_iwidget.meta;
                        if (iwidget_meta.uri == this.uri) {
                            widget.internal_iwidget.meta = this;
                        }
                    }, new_meta);
                }
            });
            layoutManager.logSubTask(utils.gettext('Purging widget info'));
            break;
        case 'operator':
            layoutManager = LayoutManagerFactory.getInstance();
            layoutManager.logSubTask(utils.gettext('Unloading affected operators'));
            result.affectedVersions.forEach(function (version) {
                var new_meta = Wirecloud.activeWorkspace.resources.remove(resource.group_id + '/' + version);
                if (new_meta != null) {
                    for (i in Wirecloud.activeWorkspace.wiring.ioperators) {
                        operator = Wirecloud.activeWorkspace.wiring.ioperators[i];
                        if (operator.meta.uri == new_meta.uri) {
                            operator.meta = new_meta;
                        }
                    }
                }
            });
            layoutManager.logSubTask(utils.gettext('Purging operator info'));
            break;
        }

        for (i = 0; i < result.affectedVersions.length; i++) {
            try {
                resource_full_id = resource.group_id + '/' + result.affectedVersions[i];
                resource = this.resources[resource_full_id];
                delete this.resources[resource_full_id];
                delete this.resourcesByType[resource.type][resource_full_id];

                index = this.resourceVersions[resource.group_id].indexOf(resource);
                this.resourceVersions[resource.group_id].splice(index, 1);
            } catch (e) {}
        }

        if (typeof next === 'function') {
            next();
        }
    };

    var uninstallSuccessCallback = function uninstallSuccessCallback(resource, next, response) {
        var result = JSON.parse(response.responseText);
        uninstallOrDeleteSuccessCallback.call(this, resource, next, result);
    };

    var uninstallErrorCallback = function uninstallErrorCallback(options, response) {
        var msg = Wirecloud.GlobalLogManager.formatAndLog(utils.gettext("Error uninstalling resource: %(errorMsg)s."), response);

        if (typeof options.onFailure === 'function') {
            options.onFailure(msg);
        }
    };

    var loadSuccessCallback = function loadFailureCallback(context, transport) {
        var resources, resource_id;

        resources = JSON.parse(transport.responseText);

        this.resources = {};
        this.resourceVersions = {};
        this.resourcesByType = {};

        for (resource_id in resources) {
            this._includeResource.call(this, resources[resource_id]);
        }

        if (typeof context.onSuccess === 'function') {
            context.onSuccess();
        }
    };

    var loadFailureCallback = function loadFailureCallback(context, transport) {
        if (typeof context.onError === 'function') {
            context.onError();
        }
    };

    var process_upload_response = function process_upload_response(response_data) {
        var i, id, resource_data;

        if (!Array.isArray(response_data)) {
            response_data = [response_data];
        }

        for (i = 0; i < response_data.length; i += 1) {
            resource_data = response_data[i];
            id = [resource_data.vendor, resource_data.name, resource_data.version].join('/');
            if (this.resourceExistsId(id)) {
                continue;
            }

            this._includeResource.call(this, resource_data);
        }
    };

    var process_packaged_upload_response = function process_packaged_upload_response(next, response_data) {
        process_upload_response.call(this, response_data);

        if (typeof next === 'function') {
            try {
                next();
            } catch (e) {}
        }
    };

    /*************************************************************************
     * Public methods
     *************************************************************************/

    var LocalCatalogue = new Wirecloud.WirecloudCatalogue({name: 'local', permissions: {'delete': false}});

    LocalCatalogue.reload = function reload(options) {

        if (typeof options !== 'object') {
            options = {};
        }

        var context = {
            'onSuccess': options.onSuccess,
            'onError': options.onError
        };

        if (Wirecloud.contextManager.get('username') !== 'anonymous') {
            Wirecloud.io.makeRequest(Wirecloud.URLs.LOCAL_RESOURCE_COLLECTION, {
                method: 'GET',
                requestHeaders: {'Accept': 'application/json'},
                onSuccess: loadSuccessCallback.bind(this, context),
                onFailure: loadFailureCallback.bind(this, context)
            });
        } else {
            loadSuccessCallback.call(this, context, {responseText: "{}"});
        }
    };

    LocalCatalogue.uninstallResource = function uninstallResource(resource, options) {
        var url;

        options = Wirecloud.Utils.merge({
            'allversions': false
        }, options);

        if (options.allversions) {
            url = Wirecloud.URLs.LOCAL_UNVERSIONED_RESOURCE_ENTRY.evaluate({
                vendor: resource.vendor,
                name: resource.name
            });
        } else {
            url = Wirecloud.URLs.LOCAL_RESOURCE_ENTRY.evaluate({
                vendor: resource.vendor,
                name: resource.name,
                version: resource.version.text
            });
        }

        // Send request to uninstall de widget
        Wirecloud.io.makeRequest(url + '?affected=true', {
            method: 'DELETE',
            requestHeaders: {'Accept': 'application/json'},
            onSuccess: uninstallSuccessCallback.bind(this, resource, options.onSuccess),
            onFailure: uninstallErrorCallback.bind(this, options),
            onComplete: options.onComplete
        });
    };

    LocalCatalogue.deleteResource = function deleteResource(resource, options) {
        if (options == null) {
            options = {};
        }

        options.onSuccess = uninstallOrDeleteSuccessCallback.bind(this, resource, options.onSuccess);
        Wirecloud.WirecloudCatalogue.prototype.deleteResource.call(this, resource, options);
    };

    LocalCatalogue.addPackagedResource = function addPackagedResource(data, options) {
        if (options == null) {
            options = {};
        }

        options.onSuccess = function (next, main_resource, extra_resources) {
            process_packaged_upload_response.call(this, next, [main_resource].concat(extra_resources));
        }.bind(this, options.onSuccess);

        Wirecloud.WirecloudCatalogue.prototype.addPackagedResource.call(this, data, options);
    };

    LocalCatalogue.addResourceFromURL = function addResourceFromURL(url, options) {
        if (typeof options != 'object') {
            options = {};
        }

        Wirecloud.io.makeRequest(Wirecloud.URLs.LOCAL_RESOURCE_COLLECTION, {
            method: 'POST',
            contentType: 'application/json',
            requestHeaders: {'Accept': 'application/json'},
            postBody: JSON.stringify({
                url: url,
                force_create: !!options.forceCreate,
                install_embedded_resources: true,
                market_endpoint: options.market_info
            }),
            onSuccess: function (response) {
                var i, id, response_data, resource_data;

                response_data = JSON.parse(response.responseText);
                process_upload_response.call(this, [response_data.resource_details].concat(response_data.extra_resources));

                if (typeof options.onSuccess === 'function') {
                    options.onSuccess();
                }
            }.bind(this),
            onFailure: function (response) {
                var msg = Wirecloud.GlobalLogManager.formatAndLog(utils.gettext("Error adding resource from URL: %(errorMsg)s."), response);

                if (typeof options.onFailure === 'function') {
                    options.onFailure(msg);
                }
            },
            onComplete: function () {
                if (typeof options.onComplete === 'function') {
                    options.onComplete();
                }
            }
        });
    };

    LocalCatalogue.getAvailableResourcesByType = function getAvailableResourcesByType(type) {
        if (type in this.resourcesByType) {
            return this.resourcesByType[type];
        } else {
            return {};
        }
    };

    LocalCatalogue._includeResource = function _includeResource(resource_data) {
        var resource, resource_id, resource_full_id;

        resource_id = resource_data.vendor + '/' + resource_data.name;
        resource_full_id = resource_id + '/' + resource_data.version;

        switch (resource_data.type) {
        case 'widget':
            resource = new Wirecloud.WidgetMeta(resource_data);
            if (Wirecloud.activeWorkspace != null) {
                Wirecloud.activeWorkspace.getIWidgets().forEach(function (widget) {
                    if (widget.internal_iwidget.meta.uri == resource.uri) {
                        widget.internal_iwidget.meta = resource;
                    }
                });
            }
            break;
        case 'operator':
            resource = new Wirecloud.wiring.OperatorMeta(resource_data);
            if (Wirecloud.activeWorkspace != null && Wirecloud.activeWorkspace.wiring != null) {
                try {
                    Wirecloud.activeWorkspace.wiring._notifyOperatorInstall(resource);
                } catch (error) {}
            }
            break;
        case 'mashup':
            resource = resource_data;
        }
        if (Wirecloud.activeWorkspace != null) {
            Wirecloud.activeWorkspace.resources.restore(resource);
        }

        if (!(resource_id in this.resourceVersions)) {
            this.resourceVersions[resource_id] = [];
        }

        this.resourceVersions[resource_id].push(resource);
        this.resources[resource_full_id] = resource;

        if (!(resource_data.type in this.resourcesByType)) {
            this.resourcesByType[resource_data.type] = {};
        }
        this.resourcesByType[resource_data.type][resource_full_id] = resource;
    };

    LocalCatalogue.hasAlternativeVersion = function hasAlternativeVersion(mac) {
        var versions = this.resourceVersions[mac.group_id];
        return versions != null && (versions.length > 1 || versions.length === 1 && !versions[0].is(mac));
    };

    LocalCatalogue.getResourceId = function getResourceId(id) {
        return this.resources[id];
    };

    LocalCatalogue.getResource = function getResource(vendor, name, version) {
        var id = [vendor, name, version].join('/');
        return this.getResourceId(id);
    };

    LocalCatalogue.resourceExistsId = function resourceExistsId(id) {
        return this.getResourceId(id) != null;
    };

    LocalCatalogue.resourceExists = function resourceExists(resource) {
        var id = [resource.vendor, resource.name, resource.version].join('/');
        return this.resourceExistsId(id);
    };

    Wirecloud.LocalCatalogue = LocalCatalogue;

})(Wirecloud.Utils);
