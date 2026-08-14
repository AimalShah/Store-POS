Feature: Media library
  Product and brand imagery can be uploaded to and removed from the media library.

  Scenario: The media library starts empty
    Given I am logged in as an admin
    When I send a GET request to "/api/media/library"
    Then the response status should be 200
    And the response body should have 0 items

  Scenario: An image can be uploaded and deleted
    Given I am logged in as an admin
    When I upload a test image
    Then the response status should be 200
    And the response body should contain field "filename"
    When I delete the uploaded image
    Then the response status should be 200
    When I send a GET request to "/api/media/library"
    Then the response body should have 0 items

  Scenario: Uploading a non-image file is rejected
    Given I am logged in as an admin
    When I send a POST request to "/api/media/upload" with body:
      """
      {"alt":"nothing"}
      """
    Then the response status should be 400
