Feature: Customers
  The customer directory stores walk-in and named customers for delivery and accounts.

  Scenario: A customer can be created and listed
    Given I am logged in as an admin
    When I create a customer named "Thabo" with phone "0825550101"
    Then the response status should be 200
    When I send a GET request to "/api/customers/all"
    Then the response body "name" should contain "Thabo"

  Scenario: A customer can be fetched by id
    Given I am logged in as an admin
    When I create a customer named "Aisha" with phone "0835550202"
    When I fetch the created customer
    Then the response status should be 200
    And the response body "name" should be "Aisha"

  Scenario: A customer can be updated
    Given I am logged in as an admin
    When I create a customer named "Old Name" with phone "000"
    When I update the created customer name to "New Name"
    Then the response status should be 200
    When I send a GET request to "/api/customers/all"
    Then the response body "name" should contain "New Name"

  Scenario: A customer can be deleted
    Given I am logged in as an admin
    When I create a customer named "Temporary" with phone "000"
    When I delete the created customer
    Then the response status should be 200
    When I send a GET request to "/api/customers/all"
    Then the response body "name" should not contain "Temporary"
