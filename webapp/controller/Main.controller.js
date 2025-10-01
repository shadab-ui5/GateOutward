sap.ui.define([
    "sap/ui/core/mvc/Controller",
], (Controller) => {
    "use strict";

    return Controller.extend("gateout.controller.Main", {

        onInit: function () {
            this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            this.oRouter.attachRouteMatched(this._onRouteMatched, this);
        },

        onAfterRendering: function () {
            const oIconTabBar = this.getView().byId("idIconTabBarMain");
            // Ensure the control exists before using it
            if (oIconTabBar) {
                oIconTabBar.setTabDensityMode("Compact");
            }
        },
        _onRouteMatched: function (oEvent) {
            const sRouteName = oEvent.getParameter("name");
            const oTabBar = this.byId("idIconTabBarMain");

            if (oTabBar) {
                oTabBar.setSelectedKey(sRouteName);
            }
        },

        /**
         * @function onSelectTabItem
         * @description Navigate to the selected tab
         * @param {object} oEvt event recovered 
         * @public
         */
        onSelectTabItem: function (oEvt) {
            const sSelectedTab = oEvt.getParameter("key");
            if (this.oRouter && sSelectedTab) {
                this.oRouter.navTo(sSelectedTab);
            } else {
                console.warn("Navigation failed.");
            }
        },
        onNavBack: function () {
            var oHistory = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("RouteGateOut", {}, true); // replace with actual route
            }
        },



    });
});