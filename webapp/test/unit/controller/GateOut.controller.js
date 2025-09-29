/*global QUnit*/

sap.ui.define([
	"gateout/controller/GateOut.controller"
], function (Controller) {
	"use strict";

	QUnit.module("GateOut Controller");

	QUnit.test("I should test the GateOut controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
