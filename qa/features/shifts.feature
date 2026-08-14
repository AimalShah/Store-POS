Feature: Shifts, X and Z reports
  A shift opens with a cash float, records sales, and closes with cash reconciliation.

  Scenario: Opening a shift records the float amount
    Given I am logged in as an admin
    When I open a shift with float 200
    Then the response status should be 200
    And the response body "floatAmount" should be "200"
    And the response body "status" should be "open"

  Scenario: A second shift cannot be opened on the same till
    Given I am logged in as an admin
    When I open a shift with float 200
    When I open a shift with float 200
    Then the response status should be 400

  Scenario: The X report summarises sales within the shift
    Given I am logged in as an admin
    When I open a shift with float 100
    When I create a paid sale in the open shift
    When I fetch the X report for the shift
    Then the response status should be 200
    And the response body "saleCount" should be "1"
    And the response body "cashSales" should be "5"

  Scenario: Closing a shift produces a Z report with cash reconciliation
    Given I am logged in as an admin
    When I open a shift with float 100
    When I create a paid sale in the open shift
    When I close the open shift with counted cash 105
    Then the response status should be 200
    And the response body "status" should be "closed"
    When I fetch the Z report for the shift
    Then the response body "expectedCash" should be "105"
    And the response body "actualCash" should be "105"
    And the response body "difference" should be "0"

  Scenario: An already-closed shift cannot be closed again
    Given I am logged in as an admin
    When I open a shift with float 100
    When I close the open shift with counted cash 100
    When I close the open shift with counted cash 100
    Then the response status should be 400

  Scenario: Shift transactions can be listed
    Given I am logged in as an admin
    When I open a shift with float 100
    When I create a paid sale in the open shift
    When I fetch the transactions for the open shift
    Then the response body should have 1 items
