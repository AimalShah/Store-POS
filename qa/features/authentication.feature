Feature: Authentication and first run
  The till must authenticate users (password or PIN) and complete a first-run setup.

  Scenario: Server health endpoint responds ok
    When I send a GET request to "/api/health"
    Then the response status should be 200
    And the response body "status" should be "ok"

  Scenario: System reports ready once the admin user exists
    When I send a GET request to "/api/users/check"
    Then the response status should be 200
    And the response body "ready" should be "true"

  Scenario: First run rejects a missing store name or short PIN
    When I send a POST request to "/api/setup/first-run" with body:
      """
      {"store":"","pin":"12"}
      """
    Then the response status should be 400

  Scenario: First run rejects a PIN longer than 6 digits
    When I send a POST request to "/api/setup/first-run" with body:
      """
      {"store":"My Store","pin":"1234567"}
      """
    Then the response status should be 400

  Scenario: Completing first run stores the store name and enables admin PIN login
    When I send a POST request to "/api/setup/first-run" with body:
      """
      {"store":"Burger Barn","pin":"123456"}
      """
    Then the response status should be 200
    And the response should be ok
    When I send a GET request to "/api/setup/first-run"
    Then the response body "firstRun" should be "false"
    When I log in with PIN "123456"
    Then the response status should be 200
    And the response body should contain field "token"

  Scenario: Password login succeeds for the default admin
    When I log in with username "admin" and password "admin"
    Then the response status should be 200
    And the response body should contain field "token"

  Scenario: Password login rejects wrong credentials
    When I log in with username "admin" and password "wrongpass"
    Then the response status should be 401

  Scenario: Password login requires both fields
    When I send a POST request to "/api/users/login" with body:
      """
      {"username":"admin"}
      """
    Then the response status should be 400

  Scenario: PIN login rejects an incorrect PIN
    When I log in with PIN "000000"
    Then the response status should be 401

  Scenario: A cashier can sign in with their PIN
    Given I log in as a cashier with PIN "4242" and no product permission
    Then the response status should be 200
    And the response body should contain field "token"
