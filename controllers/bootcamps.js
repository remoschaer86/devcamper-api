const Bootcamp = require('../models/Bootcamp');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const geocoder = require('../utils/geocoder');
const path = require('path');

// @desc    Get all bootcamps
// @route   Get /api/v1/bootcamps
// @access  Public
exports.getBootcamps = asyncHandler(async (req, res, next) => {
	res
		.status(200)
		.json(res.advancedResults);
});

// @desc    Get singlel bootcamps
// @route   Get /api/v1/bootcamps/:id
// @access  Public
exports.getBootcamp = asyncHandler(async (req, res, next) => {
	const bootcamp = await Bootcamp.findById(req.params.id);
	if (!bootcamp) {
		return next(
			new ErrorResponse(`Bootcamp not found with id of ${req.params.id}`, 404)
		);
	}
	res.status(200).json({ success: true, data: bootcamp });
});

// @desc    Create new bootcamps
// @route   POST /api/v1/bootcamps/:id
// @access  Private
exports.createBootcamp = asyncHandler(async (req, res, next) => {

	req.body.user = req.user.id;

	const publishedBootcamps = await Bootcamp.findOne({user: req.user.id});

	if(publishedBootcamps && req.user.role !== 'admin') {
		return next(new ErrorResponse(`The user with the id ${req.user.id} cannot publish more than one bootcamp`, 400))
	}

	const bootcamp = await Bootcamp.create(req.body);
	res.status(201).json({ success: true, data: bootcamp });
});

// @desc    Update bootcamps
// @route   PUT /api/v1/bootcamps/:id
// @access  Private
exports.updateBootcamp = asyncHandler(async (req, res, next) => {
	let bootcamp = await Bootcamp.findById(req.params.id);

	if (!bootcamp) {
		return next(
			new ErrorResponse(`Bootcamp not found with id of ${req.params.id}`, 404)
		);
	}

	// Make sure user is bootcamp owner
	if(bootcamp.user.toString() !== req.user.id && req.user.role !== 'admin') {
		return next(new ErrorResponse(`User ${req.params.id} is not authorized to udate this bootcamp`, 401))
	} 

	bootcamp = await Bootcamp.findByIdAndUpdate(req.params.id, req.body, {
		new: true,
		runValidators: true
	})


	res.status(200).json({ success: true, data: bootcamp });
});

// @desc    Delete bootcamps
// @route   DELETE /api/v1/bootcamps/:id
// @access  Private
exports.deleteBootcamp = asyncHandler(async (req, res, next) => {
	const bootcamp = await Bootcamp.findById(req.params.id);
	if (!bootcamp) {
		return next(
			new ErrorResponse(`Bootcamp not found with id of ${req.params.id}`, 404)
		);
	}

	// Make sure user is bootcamp owner
	if(bootcamp.user.toString() !== req.user.id && req.user.role !== 'admin') {
		return next(new ErrorResponse(`User ${req.params.id} is not authorized to delete this bootcamp`, 401))
	} 

	bootcamp.remove();

	res.status(200).json({ success: true, data: {} });
});

// @desc    GET bootcamps by distance
// @route   GET /api/v1/bootcamps/radius/:zipcode/:distance
// @access  Private
exports.getBootcampsInRadius = asyncHandler(async (req, res, next) => {
	const { zipcode, distance } = req.params;

	console.log(zipcode, distance);

	const loc = await geocoder.geocode(zipcode);

	const lat = loc[0].latitude;
	const lng = loc[0].longitude;

	// calc radius
	const radius = distance / 6378; // 6378 = radius of the earth

	const bootcamps = await Bootcamp.find({
		location: { $geoWithin: { $centerSphere: [[lng, lat], radius] } }
	});

	res
		.status(200)
		.json({ success: true, count: bootcamps.length, data: bootcamps });
});


// @desc    Upload photo for bootcamp
// @route   PUT /api/v1/bootcamps/:id/Photo
// @access  Private
exports.bootcampPhotoUpload = asyncHandler(async (req, res, next) => {
	const bootcamp = await Bootcamp.findById(req.params.id);
	if (!bootcamp) {
		return next(
			new ErrorResponse(`Bootcamp not found with id of ${req.params.id}`, 404)
		);
	}

		// Make sure user is bootcamp owner
	if(bootcamp.user.toString() !== req.user.id && req.user.role !== 'admin') {
			return next(new ErrorResponse(`User ${req.params.id} is not authorized to upload a photo for this bootcamp`, 401))
	} 

	if(!req.files) {
		return next(new ErrorResponse('Please upload a file', 400))
	}
	console.log(req.files.file)

	const file = req.files.file;

	// check file type
	if(!file.mimetype.startsWith('image')) {
		return next(
			new ErrorResponse(`Please upload an image file`, 404)
		);
	}

	// check file size
	if(file.size > process.env.MAX_FILE_UPLOAD) {
		return next(
			new ErrorResponse(`Max file size is ${process.env.MAX_FILE_UPLOAD}`, 404)
		);
	}

	// Create custom file name
	file.name= `photo_${bootcamp._id}${path.parse(file.name).ext}`;

	file.mv(`${process.env.FILE_UPLOAD_PATH}/${file.name}`, async err => {
		if(err) {
			return next(
				new ErrorResponse(`Problem with file upload`, 500)
			);
		}

		await Bootcamp.findByIdAndUpdate(req.params.id, {photo: file.name})

		res.status(200).json({
			success: true,
			data: file.name
		})
	})

});
