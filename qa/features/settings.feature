Feature: Settings
  Store details, tax, currency, and till configuration are managed in Settings.

  Scenario: Default settings are returned
    Given I am logged in as an admin
    When I send a GET request to "/api/settings/get"
    Then the response status should be 200
    And the response body should contain field "settings.store"

  Scenario: Store details and currency can be updated
    Given I am logged in as an admin
    When I send a POST request to "/api/settings/post" with body:
      """
      {"store":"Burger Barn","symbol":"R","percentage":15,"charge_tax":true,"till":2}
      """
    Then the response status should be 200
    When I send a GET request to "/api/settings/get"
    Then the response body "settings.store" should be "Burger Barn"
    And the response body "settings.symbol" should be "R"
    And the response body "settings.percentage" should be "15"
    And the response body "settings.charge_tax" should be "true"

  Scenario: Tax flag normalises truthy strings to a boolean
    Given I am logged in as an admin
    When I send a POST request to "/api/settings/post" with body:
      """
      {"charge_tax":"on"}
      """
    Then the response status should be 200
    When I send a GET request to "/api/settings/get"
    Then the response body "settings.charge_tax" should be "true"
