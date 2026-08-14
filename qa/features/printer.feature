Feature: Printers
  The receipt and kitchen (KOT) printers are configured by interface, connection
  details, and paper width. Settings persist and drive thermal printing.

  Scenario: Default printer settings use a 58mm width
    Given I am logged in as an admin
    When I send a GET request to "/api/printer/settings"
    Then the response status should be 200
    And the response body "printer.width" should be "58"

  Scenario: A network receipt printer is configured and persisted
    Given I am logged in as an admin
    When I send a POST request to "/api/printer/settings" with body:
      """
      {"interface":"network","networkHost":"192.168.1.50","networkPort":9100,"width":80}
      """
    Then the response status should be 200
    When I send a GET request to "/api/printer/settings"
    Then the response body "printer.interface" should be "network"
    And the response body "printer.networkHost" should be "192.168.1.50"
    And the response body "printer.width" should be "80"

  Scenario: A USB printer uses the OS device path (Windows "USB001")
    Given I am logged in as an admin
    When I send a POST request to "/api/printer/settings" with body:
      """
      {"interface":"usb","usbDevice":"USB001","width":58}
      """
    Then the response status should be 200
    When I send a GET request to "/api/printer/settings"
    Then the response body "printer.interface" should be "usb"
    And the response body "printer.usbDevice" should be "USB001"

  Scenario: KOT printer and auto-print are configured
    Given I am logged in as an admin
    When I send a POST request to "/api/printer/settings" with body:
      """
      {"interface":"network","networkHost":"192.168.1.50","networkPort":9100,"width":80,"kotInterface":"usb","kotUsbDevice":"USB002","kotWidth":58,"autoPrintKot":true}
      """
    Then the response status should be 200
    When I send a GET request to "/api/printer/settings"
    Then the response body "printer.kotInterface" should be "usb"
    And the response body "printer.autoPrintKot" should be "true"

  Scenario: An out-of-range paper width falls back to 58mm
    Given I am logged in as an admin
    When I send a POST request to "/api/printer/settings" with body:
      """
      {"interface":"network","networkHost":"192.168.1.9","networkPort":9100,"width":72}
      """
    Then the response status should be 200
    When I send a GET request to "/api/printer/settings"
    Then the response body "printer.width" should be "58"
