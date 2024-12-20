


import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import path from 'path';


import nlp from "compromise";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log(__dirname);

dotenv.config({ path: '.env' });

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const carSchema = new mongoose.Schema({
  price: Number,
  color: String,
  seats: Number,
  fuel_type: String,
  tier_type: String,
  model: String,
  car_type: String,
  mileage: String,
  brand:String,
  engine_model: String,
  image: String, // image field to store image filename
  Made:String,
  airbags:Number,
}, { collection: 'demos_tb' });

const Car = mongoose.model('demos_tb', carSchema);

// Serve images from the uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Fetch cars with filters
app.get('/car_tb', async (req, res) => {
  const filters = {};

  // Parse filters from query params
  Object.entries(req.query).forEach(([key, value]) => {
    if (value) {
      if (key === 'price') {
        // Handle price ranges
        if (value === '3L to 10L') {
          filters.price = { $gte: 300000, $lte: 1000000 };
        } else if (value === '10L to 20L') {
          filters.price = { $gte: 1000000, $lte: 2000000 };
        } else if (value === '20L to 40L') {
          filters.price = { $gte: 2000000, $lte: 4000000 };
        } else if (value === 'above 50L') {
          filters.price = { $gte: 5000000 };
        }
      } else if (key === 'seats') {
        filters.seats = parseInt(value);
      } else {
        filters[key] = value;
      }
    }
  });

  try {
    // Fetch cars based on filters
    const cars = await Car.find(filters);

    // Add the full URL for each car's image
    const carsWithImages = cars.map(car => ({
  ...car.toObject(),
  imageUrl: `http://localhost:7000/uploads/${path.basename(car.image)}` // Ensure correct image path
}));


    // Send the filtered cars data with image URLs
    res.json(carsWithImages);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving cars', error: err });
  }
});


// // Search Endpoint
// app.post("/cars/search", async (req, res) => {
//   try {
//     const { query } = req.body;
//     console.log(query);
//     if (!query) {
//       return res.json([]);
//     }

//     // Search functionality
//     const searchResults = await Car.aggregate([
//       {
//         $search: {
//           index: "default",
//           text: {
//             query: query,
//             path: ["model", "brand", "color", "fuel_type", "seats"],
//           },
//         },
//       },
//     ]);

//     // Airbags mapping
//     const airbagsMap = {
//       "2 airbags": 2,
//       "3 airbags": 3,
//       "4 airbags": 4,
//       "5 airbags": 5,
//       "6 airbags": 6,
//       "7 airbags": 7,
//       "8 airbags": 8,
//     };

//     const lowerCaseQuery = query.toLowerCase();
//     const filters = {};

//     for (const [key, value] of Object.entries(airbagsMap)) {
//       if (lowerCaseQuery.includes(key)) {
//         filters.airbags = value;
//         break;
//       }
//     }

//     const searchResultsWithImages = searchResults.map((car) => ({
//       ...car,
//       imageUrl: `http://localhost:7000/uploads/${path.basename(car.image)}`,
//     }));

//     res.json(searchResultsWithImages);

//   } catch (error) {
//     console.error("Error during search:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });



app.post("/cars/suggestions", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.json([]);
    }

    // Use NLP to extract potential keywords from the sentence
    const doc = nlp(query);
    const keywords = [
      ...doc.match("#Color").out("array"), // Extract colors
      ...doc.match("#Noun").out("array"), // Extract nouns (could be models/brands)
    ];

    // Fallback to regex-based approach if NLP doesn't extract much
    const searchTerms = keywords.length ? keywords : query.split(/\s+/);

    // Create a dynamic query using extracted terms
    const searchQuery = {
      $or: searchTerms.map((term) => ({
        $or: [
          { model: { $regex: term, $options: "i" } },
          { brand: { $regex: term, $options: "i" } },
          { color: { $regex: term, $options: "i" } },
          { fuel_type: { $regex: term, $options: "i" } },
        ],
      })),
    };

    // Fetch suggestions from the database
    const suggestions = await Car.find(searchQuery).limit(5);

    // Map suggestions to a display format
    const suggestionList = suggestions.map(
      (car) => `${car.brand} ${car.model} ${car.color}`
    );

    res.json(suggestionList);
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});




// // Combined Search and Suggestions Endpoint
// app.post("/cars/suggestions", async (req, res) => {
//   try {
//     const { query } = req.body;

//     if (!query) {
//       return res.json({
//         searchResults: [],
//         suggestions: [],
//       });
//     }

//     // Search functionality
//     const searchResults = await Car.aggregate([
//       {
//         $search: {
//           index: "default",
//           text: {
//             query: query,
//             path: ["model", "brand", "color", "fuel_type", "seats"],
//           },
//         },
//       },
//     ]);

//     // Airbags mapping
//     const airbagsMap = {
//       "2 airbags": 2,
//       "3 airbags": 3,
//       "4 airbags": 4,
//       "5 airbags": 5,
//       "6 airbags": 6,
//       "7 airbags": 7,
//       "8 airbags": 8,
//     };

//     const lowerCaseQuery = query.toLowerCase();
//     const filters = {};

//     for (const [key, value] of Object.entries(airbagsMap)) {
//       if (lowerCaseQuery.includes(key)) {
//         filters.airbags = value;
//         break;
//       }
//     }

//     const searchResultsWithImages = searchResults.map((car) => ({
//       ...car,
//       imageUrl: `http://localhost:7000/uploads/${path.basename(car.image)}`,
//     }));

//     // Suggestions functionality
//     // Use NLP to extract potential keywords from the sentence
//     const doc = nlp(query);
//     const keywords = [
//       ...doc.match("#Color").out("array"), // Extract colors
//       ...doc.match("#Noun").out("array"), // Extract nouns (could be models/brands)
//     ];

//     // Fallback to regex-based approach if NLP doesn't extract much
//     const searchTerms = keywords.length ? keywords : query.split(/\s+/);

//     // Create a dynamic query using extracted terms
//     const searchQuery = {
//       $or: searchTerms.map((term) => ({
//         $or: [
//           { model: { $regex: term, $options: "i" } },
//           { brand: { $regex: term, $options: "i" } },
//           { color: { $regex: term, $options: "i" } },
//           { fuel_type: { $regex: term, $options: "i" } },
//         ],
//       })),
//     };

//     // Fetch suggestions from the database
//     const suggestions = await Car.find(searchQuery).limit(5);

//     // Map suggestions to a display format
//     const suggestionList = suggestions.map(
//       (car) => `${car.brand} ${car.model} ${car.color}`
//     );

//     res.json({
//       searchResults: searchResultsWithImages,
//       suggestions: suggestionList,
//     });
//   } catch (error) {
//     console.error("Error during search and suggestions:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });




// app.post("/cars/suggestions", async (req, res) => {


//   try {
//     const { query } = req.body;
//     /*console.log("Received query:", query);*/

//     if (!query) {
//       return res.json([]);
//     }

//     // Use NLP to extract potential keywords from the sentence
//     const doc = nlp(query);
//     const keywords = [
//       ...doc.match("#Color").out("array"), // Extract colors
//       ...doc.match("#Noun").out("array"), // Extract nouns (could be models/brands)
//     ];

//     // Fallback to regex-based approach if NLP doesn't extract much
//     const searchTerms = keywords.length ? keywords : query.split(/\s+/);

//     // Create a dynamic query using extracted terms
//     const searchQuery = {
//       $or: searchTerms.map((term) => ({
//         $or: [
//           { model: { $regex: term, $options: "i" } },
//           { brand: { $regex: term, $options: "i" } },
//           { color: { $regex: term, $options: "i" } },
//           { fuel_type: { $regex: term, $options: "i" } },
//         ],
//       })),
//     };

//     // Fetch suggestions from the database
//     const suggestions = await Car.find(searchQuery).limit(5);

//     // Map suggestions to a display format
//     const suggestionList = suggestions.map(
//       (car) => `${car.brand} ${car.model} ${car.color}`
//     );

//     res.json(suggestionList);
//   } catch (error) {
//     console.error("Error fetching suggestions:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

/*

app.post("/cars/suggestions", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.json([]);
    }

    // Use regex to match suggestions (temporary solution)
    const suggestions = await Car.find({
      $or: [
        { model: { $regex: query, $options: "i" } },
        { brand: { $regex: query, $options: "i" } },
        { color: { $regex: query, $options: "i" } },
        { fuel_type: { $regex: query, $options: "i" } },
      ],
    }).limit(5);

    // Map suggestions to a display format
    const suggestionList = suggestions.map(
      (car) => `${car.brand} ${car.model} ${car.color}`
    );

    res.json(suggestionList);
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
*/

// Search Endpoint
/*
app.post("/cars/search", async (req, res) => {
  try {
    const { query } = req.body;

    const searchResults = await Car.aggregate([
      {
        $search: {
          index: "default",
          text: {
            query: query,
            path: ["model", "brand", "color", "fuel_type", "seats"],
          },
        },
      },
    ]);

    //airbags code

    const airbagsMap = {
      '2 airbags': 2,
      '3 airbags': 3,    // "2 airbags" maps to 2 airbags
      '4 airbags': 4, 
      '5 airbags': 5,    // "4 airbags" maps to 4 airbags
      '6 airbags': 6,
      '7 airbags': 7,    // "6 airbags" maps to 6 airbags
      '8 airbags': 8,    // "8 airbags" maps to 8 airbags
    };

    const lowerCaseQuery = query.toLowerCase();
    const filters = {};

  
    for (const [key, value] of Object.entries(airbagsMap)) {
      if (lowerCaseQuery.includes(key)) {
        filters.airbags = value;
        break;
      }
    }

    const searchResultsWithImages = searchResults.map((car) => ({
      ...car,
      imageUrl: `http://localhost:7000/uploads/${path.basename(car.image)}`,
    }));

    res.json(searchResultsWithImages);
  } catch (error) {
    console.error("Error during search:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}); */

// Search route

app.post('/cars/search', async (req, res) => {
  try {
    const { query } = req.body;

    const searchResults = await Car.aggregate([
      {
        $search: {
          index: "default", // Name of your search index
          text: {
            query: query,
            path: ["model", "brand", "Made", "car_type", "color", "fuel_type", "seats", "airbags"], // Fields to search
          },
        },
      },
    ]);


    // Add the full URL for each car's image
    const searchResultsWithImages = searchResults.map(car => ({
      ...car,
      imageUrl: `http://localhost:7000/uploads/${path.basename(car.image)}`, // Ensure correct image path
    }));

    res.json(searchResultsWithImages);
  } catch (error) {
    console.error('Error during search:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/', (req, res) => res.send('Welcome to the Car API'));

const PORT = 7000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});