from rest_framework import serializers

from .models import Tuman, Viloyat


class ViloyatRoyxatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Viloyat
        fields = ["region_id", "nom", "bbox"]


class ViloyatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Viloyat
        fields = ["region_id", "nom", "soato", "bbox"]


class TumanRoyxatSerializer(serializers.ModelSerializer):
    region_id = serializers.IntegerField(source="viloyat.region_id", read_only=True)

    class Meta:
        model = Tuman
        fields = ["kod", "nom", "tip", "region_id", "bbox"]


class TumanSerializer(serializers.ModelSerializer):
    region_id = serializers.IntegerField(source="viloyat.region_id", read_only=True)

    class Meta:
        model = Tuman
        fields = ["kod", "nom", "tip", "soato", "region_id", "bbox"]
