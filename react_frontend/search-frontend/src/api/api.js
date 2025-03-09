export async function keywordSearch(searchTerm) {
    try {
      const options = {
        method: 'POST',                   // Specify the HTTP method
        headers: {
            'Content-Type': 'application/json' // Specify the content type
            // Add any other headers you need (authentication, etc.)
        },
        body: JSON.stringify({query: searchTerm})          // Convert data object to JSON string
      };
      // Replace with your actual API endpoint
      //const response = await fetch('https://search.carsonblinn.com/keyword',options);
      const response = await fetch('http://localhost:8000/keyword',options);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }
  
  export async function fetchPDF(documentId) {
    try {
      // Replace with your actual API endpoint
      const response = await fetch(`https://search.carsonblinn.com/pdf/${documentId}`);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      // Return the PDF as a blob
      return await response.blob();
    } catch (error) {
      console.error('Error fetching PDF:', error);
      throw error;
    }
  }