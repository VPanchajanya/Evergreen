package OpenILS::Application::Search;
use base qw/OpenSRF::Application/;
use strict; use warnings;
use JSON;

use OpenILS::Utils::Fieldmapper;
use OpenILS::Utils::ModsParser;
use OpenSRF::Utils::SettingsClient;
use OpenSRF::Utils::Cache;


#use OpenILS::Application::Search::StaffClient;
use OpenILS::Application::Search::Biblio;
use OpenILS::Application::Search::Authority;
use OpenILS::Application::Search::Actor;
use OpenILS::Application::Search::Z3950;

use OpenILS::Application::AppUtils;

use Time::HiRes qw(time);
use OpenSRF::EX qw(:try);

use Text::Aspell; # spell checking...


# Houses generic search utilites 

sub initialize {
	OpenILS::Application::Search::Z3950->initialize();
}

sub filter_search {
	my($self, $str, $full) = @_;

	my $string = $str;	

	$string =~ s/\s+the\s+/ /oi;
	$string =~ s/\s+an\s+/ /oi;
	$string =~ s/\s+a\s+/ /oi;

	$string =~ s/^the\s+//io;
	$string =~ s/^an\s+//io;
	$string =~ s/^a\s+//io;

	$string =~ s/\s+the$//io;
	$string =~ s/\s+an$//io;
	$string =~ s/\s+a$//io;

	$string =~ s/^the$//io;
	$string =~ s/^an$//io;
	$string =~ s/^a$//io;


	if(!$full) {
		if($string =~ /^\s*$/o) {
			return "";
		} else {
			return $str;
		}
	}

	my @words = qw/ 
	fiction
 	bibliograph
 	juvenil    
 	histor   
 	literatur
 	biograph
 	stor    
 	american 
 	videorecord
 	count  
 	film   
 	life  
 	book 
 	children 
 	centur 
 	war    
 	genealog
 	etc    
	state
	unit
	/;

	push @words, "united state";

	for my $word (@words) {
		if($string =~ /^\s*"?\s*$word\w*\s*"?\s*$/i) {
			return "";
		}
	}

	warn "Cleansed string to: $string\n";
	if($string =~ /^\s*$/o) {
		return "";
	} else {
		return $str;
	}
	
	return $string;
}	


__PACKAGE__->register_method(
	method	=> "check_spelling",
	api_name	=> "open-ils.search.spell_check");

sub check_spelling {
	my( $self, $client, $phrase ) = @_;

	my @resp_objects = ();
	my $speller = Text::Aspell->new();
	$speller->set_option('lang', 'en_US');
	my $return_something = 0;

	my $return_phrase = "";

	for my $word (split(' ',$phrase) ) {
		if( ! $speller->check($word) ) {
			if( $speller->suggest($word) ) { $return_something = 1; }
			$return_something = 1;
			my $word_stuff = {};
			$word_stuff->{'word'} = $word;
			$word_stuff->{'suggestions'} = [ $speller->suggest( $word ) ];
			if( ! $return_phrase ) { $return_phrase = ($speller->suggest($word))[0]; }
			else { $return_phrase .= " " . ($speller->suggest($word))[0];}
			
		} else { 
			if( ! $return_phrase ) { $return_phrase = $word; }
			else { $return_phrase .= " $word"; }
		}
	}

	if( $return_something ) { return $return_phrase; }
	return 0;

}

1;
