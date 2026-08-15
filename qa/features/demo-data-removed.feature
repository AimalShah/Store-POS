Feature: Demo data removed
  The demo seed/clear endpoints were removed from the app along with their UI
  (Catalog "Seed demo" button, Settings "Demo data" section, Shifts sidebar
  entry). The endpoints must no longer exist, while the remaining shift
  lifecycle API keeps working.

  Scenario: Demo seed endpoint no longer exists
    Given I am logged in as an admin
    When I send a POST request to "/api/demo/seed" with body:
      """
      {}
      """
    Then the response status should be 404

  Scenario: Demo clear endpoint no longer exists
    Given I am logged in as an admin
    When I send a POST request to "/api/demo/clear" with body:
      """
      {}
      """
    Then the response status should be 404

  Scenario: Demo endpoints are rejected without authentication
    When I send a POST request to "/api/demo/seed" without authentication
    Then the response status should be 401

  Scenario: Shift lifecycle still works without the sidebar entry
    Given I am logged in as an admin
    When I open a shift with float 100
    Then the response status should be 200
    And the response body "floatAmount" should be "100"
