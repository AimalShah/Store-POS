Feature: Categories
  The catalog is organised into categories (Pizzas, Burgers, Drinks, ...).

  Scenario: A fresh database has no categories
    Given I am logged in as an admin
    When I fetch the category list
    Then the response body should have 0 items

  Scenario: A category can be created
    Given I am logged in as an admin
    When I create a category named "Burgers"
    Then the response status should be 200
    When I fetch the category list
    Then the response body "name" should contain "Burgers"

  Scenario: Creating a category requires a name
    Given I am logged in as an admin
    When I send a POST request to "/api/categories/category" with body:
      """
      {"name":""}
      """
    Then the response status should be 400

  Scenario: A category can be renamed
    Given I am logged in as an admin
    When I create a category named "Old Name"
    When I rename the created category to "New Name"
    Then the response status should be 200
    When I fetch the category list
    Then the response body "name" should contain "New Name"

  Scenario: A category can be deleted
    Given I am logged in as an admin
    When I create a category named "Temporary"
    When I delete the created category
    Then the response status should be 200
    When I fetch the category list
    Then the response body "name" should not contain "Temporary"
